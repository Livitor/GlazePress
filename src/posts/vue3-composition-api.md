---
title: "Vue 3 Composition API 深度解析"
date: "2026-04-18"
tags: ["Vue", "前端", "JavaScript"]
categories: ["前端开发"]
description: "深入理解 Vue 3 的 Composition API，包括 ref、reactive、computed、watch 等核心概念，以及如何在实际项目中优雅地组织代码。"
author: ""
draft: false
---

# Vue 3 Composition API 深度解析

Vue 3 的 **Composition API**（组合式 API）是框架最重要的特性之一。它提供了一种更灵活、更可复用的代码组织方式。

## 为什么需要 Composition API？

在 Vue 2 中，我们使用 Options API：

```javascript
// Options API - 逻辑分散
export default {
  data() {
    return {
      count: 0,
      user: null,
      loading: false
    }
  },
  computed: {
    doubledCount() { return this.count * 2 }
  },
  methods: {
    increment() { this.count++ },
    async fetchUser() { /* ... */ }
  },
  mounted() { this.fetchUser() }
}
```

**问题**：当组件变得复杂时，相关逻辑分散在不同的选项中，难以维护和复用。

## 核心响应式 API

### ref — 基本类型响应式

```typescript
import { ref } from 'vue'

const count = ref(0)        // 数字
const message = ref('')     // 字符串
const isVisible = ref(false) // 布尔值

// 访问/修改需要 .value
console.log(count.value)
count.value++
```

### reactive — 对象类型响应式

```typescript
import { reactive } from 'vue'

const state = reactive({
  user: null,
  posts: [],
  filters: {
    keyword: '',
    tag: ''
  }
})

// 无需 .value
state.user = { name: 'Alice' }
state.filters.keyword = 'Vue'
```

### computed — 计算属性

```typescript
import { ref, computed } from 'vue'

const count = ref(0)
const doubled = computed(() => count.value * 2)

// 只读计算属性
const fullName = computed(() => `${firstName.value} ${lastName.value}`)

// 可写计算属性
const doubleCount = computed({
  get: () => count.value * 2,
  set: (val) => { count.value = val / 2 }
})
```

### watch & watchEffect — 响应式侦听

```typescript
// watch：明确指定数据源
watch(count, (newVal, oldVal) => {
  console.log(`count changed: ${oldVal} -> ${newVal}`)
}, { immediate: true })

// watchEffect：自动追踪依赖
watchEffect(() => {
  console.log(`Current value: ${count.value}`)
})

// 监听多个源
watch([count, message], ([c, m], [oldC, oldM]) => {
  // ...
})
```

## 自定义 Composables

Composition API 的真正威力在于 **可组合性**：

```typescript
// composables/useCounter.js
import { ref, computed } from 'vue'

export function useCounter(initialValue = 0) {
  const count = ref(initialValue)
  const doubled = computed(() => count.value * 2)

  function increment(step = 1) { count.value += step }
  function decrement(step = 1) { count.value -= step }
  function reset() { count.value = initialValue }

  return { count, doubled, increment, decrement, reset }
}

// 在组件中使用
export default {
  setup() {
    const { count, doubled, increment } = useCounter()

    return { count, doubled, increment }
  }
}
```

## 实战模式对比

| 模式 | 适用场景 | 复杂度 |
|------|----------|--------|
| `ref` | 基本类型、需要替换整个值的场景 | 低 |
| `reactive` | 对象、深层嵌套数据 | 中 |
| `computed` | 派生状态、缓存 | 低 |
| `watch` | 需要获取新旧值的副作用 | 中 |
| `watchEffect` | 自动追踪依赖的副作用 | 低 |
| `Composable` | 跨组件逻辑复用 | 高 |

## 性能优化技巧

1. **使用 shallowRef / shallowReactive** — 避免深层响应式开销
2. **triggerRef 手动触发** — 批量更新后一次性触发
3. **v-memo** — 条件缓存 DOM 子树
4. **Suspense** — 异步组件加载状态管理

> **注意**: 在 GlazePress 中，我们通过 CDN 引入 Vue 3 的 Global Build，因此所有交互功能都运行在浏览器端。构建过程本身不涉及 Vue 编译。

---

掌握 Composition API 是成为 Vue 3 高级开发者的必经之路。建议在实践中多写 Composables，培养"组合思维"而非"继承思维"。
