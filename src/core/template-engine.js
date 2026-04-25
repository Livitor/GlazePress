/**
 * GlazePress 模板引擎 v7 — 最终修正版字符串扫描解析器
 *
 * 核心算法：逐字符线性扫描，遇到 '{{' 时按后续字符分派处理。
 *   '{{#'      → 块开标签（递归进入子解析）
 *   '{{{'      → 原始输出
 *   '{{' + 其他 → 变量替换
 *
 * 关键修复：所有正则均使用 new RegExp() 避免转义/终止符问题
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

class TemplateEngine {
  constructor(options = {}) { this.partialsDir = options.partialsDir || ''; this.cache = new Map(); }
  
  render(tpl, data) { return this._parse(this._expandPartials(tpl), 0, this._expandPartials(tpl).length, data); }
  
  renderFile(path, data) {
    const abs = resolve(path);
    if (!this.cache.has(abs)) this.cache.set(abs, readFileSync(abs, 'utf-8'));
    return this.render(this.cache.get(abs), data);
  }
  
  clearCache() { this.cache.clear(); }

  _expandPartials(t) {
    return t.replace(/\{\{>\s*(.+?)\s*\}\}/g, (_, name) => {
      const p = resolve(this.partialsDir, `${name}.html`);
      try { return existsSync(p) ? readFileSync(p, 'utf-8') : ''; } catch(e) { return ''; }
    });
  }

  // ==================== 主解析 ====================
  _parse(t, start, end, ctx) {
    let out = '', i = start;
    while (i < end) {
      if (t[i] !== '{' || i + 1 >= end || t[i + 1] !== '{') { out += t[i++]; continue; }
      
      // t[i]='{' && t[i+1]='{'
      const c2 = i + 2 < end ? t[i + 2] : '';

      if (c2 === '#') {
        // {{#type cond}} — 支持 if / unless / each / with
        const m = new RegExp('^\\{\\{#\\s*(each|if|unless|with)\\s+(.*?)\\}\\}').exec(t.substring(i));
        if (!m) { out += t[i++]; continue; }
        const [/*full*/, type, cond] = m;
        const cs = i + m[0].length;

        // 按深度追踪找 {{/type}}
        const ci = this._findClose(t, cs, end, type);
        if (!ci) { out += t.slice(i, end); break; }

        const body = t.substring(cs, ci.ce);
        out += type === 'each'   ? this._each(cond, body, ctx)
             : type === 'if'     ? this._if(cond, body, ctx)
             : type === 'unless' ? this._unless(cond, body, ctx)
             : type === 'with'   ? this._with(cond, body, ctx) : '';
        i = ci.te;
        continue;
      }

      if (c2 === '{') {
        // {{{raw}}}
        const ei = t.indexOf('}}}', i + 3);
        if (ei !== -1 && ei < end) { out += this._resolve(t.substring(i + 3, ei).trim(), ctx) ?? ''; i = ei + 3; continue; }
      }

      // {{expr}}
      const ci = t.indexOf('}}', i + 2);
      if (ci === -1 || ci >= end) { out += t[i++]; continue; }
      const expr = t.substring(i + 2, ci).trim();
      if (expr.startsWith('/') || expr.startsWith('#') || expr.startsWith('>')) { out += t.slice(i, ci + 2); i = ci + 2; continue; }
      const v = this._resolve(expr, ctx);
      out += (v != null) ? this._esc(String(v)) : '';
      i = ci + 2;
    }
    return out;
  }

  // ==================== 闭标签查找 ====================
  _findClose(t, s, lim, expectedType) {
    let d = 1, p = s;
    while (p < lim - 2 && d > 0) {
      const sub = t.substring(p);
      // 检查内层开标签 {{#...
      if (sub[0]==='{' && sub[1]==='{' && sub[2]==='#') {
        d++; const e = t.indexOf('}}', p+3);
        p = e === -1 ? p+3 : e+2; continue;
      }
      // 检查闭标签 {{/type}}
      if (sub[0]==='{' && sub[1]==='{' && sub[2]==='/') {
        // 使用 new RegExp 避免转义/终止符问题！
        const cm = new RegExp('^\\{\\{\\/(each|if|unless|with)\\}\\}').exec(sub);
        if (cm) {
          d--;
          if (d === 0 && cm[1] === expectedType) return { ce: p, te: p + cm[0].length };
          p += cm[0].length; continue;
        }
      }
      p++;
    }
    return null;
  }

  // ==================== 渲染器 ====================
  _each(path, body, d) {
    const items = this._resolve(path, d);
    if (!items) return '';

    // 支持数组迭代
    if (Array.isArray(items)) {
      return items.map((item, n) => {
        const c = typeof item==='object' ? item : {_value:item};
        const x = {...d, this:c, '@index':n, '@first':n===0,'@last':n===items.length-1,'@total':items.length};
        if(typeof item!=='object')x.this=item;
        return this._parse(body, 0, body.length, x);
      }).join('');
    }

    // 支持对象迭代 — {{@key}} 可用
    if (typeof items === 'object') {
      const entries = Object.entries(items);
      return entries.map(([key, value], n) => {
        const c = typeof value==='object' && value!==null ? value : {_value:value};
        const x = {...d, this:c, '@key':key, '@index':n, '@first':n===0,'@last':n===entries.length-1,'@total':entries.length};
        if(typeof value!=='object'||value===null)x.this=value;
        return this._parse(body, 0, body.length, x);
      }).join('');
    }

    return '';
  }

  _if(cond, body, d) {
    const {trueBranch, falseBranch} = this._elseSplit(body);
    let isTrue;

    // 支持比较表达式: (eq a b), (neq a b), (gt a b), (lt a b), (gte a b), (lte a b)
    const compMatch = cond.trim().match(/^\((eq|neq|gt|lt|gte|lte)\s+(.+?)\s+(.+)\)$/);
    if (compMatch) {
      const [, op, left, right] = compMatch;
      const lv = this._resolve(left.trim(), d);
      const rv = this._resolve(right.trim(), d);
      switch(op) {
        case 'eq':  isTrue = lv == rv; break;
        case 'neq': isTrue = lv != rv; break;
        case 'gt':  isTrue = Number(lv) > Number(rv); break;
        case 'lt':  isTrue = Number(lv) < Number(rv); break;
        case 'gte': isTrue = Number(lv) >= Number(rv); break;
        case 'lte': isTrue = Number(lv) <= Number(rv); break;
      }
    } else {
      isTrue = this._isTruthy(this._resolve(cond.trim(), d));
    }

    const chosen = isTrue ? trueBranch : (falseBranch ?? '');
    return this._parse(chosen, 0, chosen.length, d);
  }

  _unless(cond, body, d) {
    // unless = if 的反义：条件为假时输出
    const {trueBranch, falseBranch} = this._elseSplit(body);
    const isTrue = this._isTruthy(this._resolve(cond.trim(), d));
    const chosen = !isTrue ? trueBranch : (falseBranch ?? '');
    return this._parse(chosen, 0, chosen.length, d);
  }

  _with(path, body, d) {
    const v = this._resolve(path, d);
    return (v && typeof v==='object') ? this._parse(body, 0, body.length, {...d,...v}) : '';
  }

  _elseSplit(t) {
    let d=0,i=0;
    while(i<t.length){
      if(t[i]==='{'&&t[i+1]==='{'&&t[i+2]==='#'){d++;i+=3;}
      else if(t[i]==='{'&&t[i+1]==='{'&&t[i+2]==='/'){d--;i+=3;}
      else if(d===0&&t.substr(i,8)==='{{else}}')return{trueBranch:t.substring(0,i),falseBranch:t.substring(i+8)};
      else i++;
    }
    return {trueBranch: t, falseBranch:null};
  }

  // ==================== 工具方法 ====================
  _resolve(p,ctx) { let c=ctx; for(const k of p.split('.')){if(c==null)return;c=k==='this'?(c.this??c):c[k];}return c; }
  _isTruthy(v){if(v==null)return false;if(v===false)return false;if(v===true)return true;if(typeof v==='number')return v!==0;if(typeof v==='string')return!!v.length;if(Array.isArray(v))return!!v.length;if(v&&typeof v==='object')return!!Object.keys(v);return true;}
  _esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,"&#39;");}
}

export default TemplateEngine;
