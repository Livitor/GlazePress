###  [npm 部署 hexo](https://www.bilibili.com/video/BV1mz4y1n7PQ?spm_id_from=333.788.videopod.sections&vd_source=74d7d8377ad5d51b73394b2a3117226a&p=4)
使用 npm 安装 hexo-cli 然后部署简单的静态网站, hexo 用于给 md 文件制作成静态网页内容, 可以作为博客使用, 当时在学习 nginx 的时候发现的彩蛋, 就给记录下来, 可以使用 docker 部署一个 nginx 服务, 然后在宿主机使用 hexo 生成的文件复制到 nginx 的 `/usr/share/nginx/http/` 目录下, 访问 nginx 提供的服务就可以直接访问该目录下的静态网站

先安装 npm 包管理器
```bash
apt install npm
```

安装 hexo-cli 
```bash
npm install hexo-cli -g
```

然后找一个用于存放该静态网站的目录
```bsah
hexo init
```

安装所需的依赖
```bash
npm install
```

用于生成静态站点的文件 (generate生成的意思)
```bash
hexo g
```

用于启动一个临时的 http 服务
```bash
hexo s
```

也可以直接省略 g s , 直接 d 一键部署 (deploy部署的意思)
```bash
hexo d
```


### docker 部署 nginx

先拉取 nginx 镜像
```bash
docker pull nginx
```

启动 nginx 服务
```bash
docker run -d -p 800:80 --name nginx nginx
```

复制宿主机中 `/other/nginx/web/public/` hexo g 生成的所有文件到 nignx 容器中的 `/usr/share/nginx/http/` 目录下 
```bash
docker cp /other/nginx/web/public/* nginx/usr/share/nginx/http/
```

访问 宿主机ip:800 就可以访问到 nginx 服务中的静态网站


### hexo 部署到 github.io
首先创建一个 github 仓库, 仓库名字一定要是 `username.github.io` , 不然访问没有页面结果, 之后访问这个网站也是这个域名

这边配置好后还要给 github 上的博客仓库中存入本机生成的 ssh 密钥, 生成密钥, 默认的第一个需要填入的是生成的密钥的文件名, 直接回车, 下面密码输入下, 然后再输入一次
```bash
ssh-keygen -t rsa -b 4096
```

然后把公钥文件内容存放到 github 博客存储库, `settings -> Deploy key -> Add deploy key` 然后输入名字和密文

可以验证下自己有没有添加成功, 然后输入生成密钥时设置的密码
```bash
ssh -T git@github.com
```
回显如下, 说明成功添加
```bash
Hi Livitor/livitor.github.io! You've successfully authenticated, but GitHub does not provide shell access.
```


然后本地创建一个文件夹用于存放网站源码, 比如 `blogs`, 然后在里面初始化该文件夹为 hexo 源码仓库
```bash
hexo init
```

然后配置本地博客仓库的 `_config.yml` 文件, deploy 下面的 type 配置使用 git , repository 配置自己博客的 ssh 仓库,  branch 配置用于提交到哪个分支
```bsah
# Deployment
## Docs: https://hexo.io/docs/one-command-deployment
deploy:
  type: git
  repository: git@github.com:Livitor/livitor.github.io.git
  branch: main
```

前面已经安装 npm , hexo-cli , 等这些工具, 还需要安装另一个工具, 用于代替我们使用 git 命令部署项目文件到 git 仓库, 这个每搭建一次本地仓库都需要下载一次, 他不是全局, 大概是当前目录使用的工具
```bash
npm install hexo-deployer-git --save
```

最后就可以直接生成, 提交到存储库了

清理 hexo 仓库缓存
```bash
hexo clean
```
生成静态网页
```bash
hexo g
```
部署到远程仓库
```bash
hexo d
```

访问网站
```bash
https://livitor.github.io
```


