---
title: "Halo 博客部署"
categories: ["建站", "运维"]
tags: ["Halo", "Docker", "博客"]
---
[官方文档](https://docs.halo.run/)
### docker-compose 部署
#### halo + mysql
```bash
version: "3"

services:
  halo:
    image: registry.fit2cloud.com/halo/halo:2.20
    restart: on-failure:3
    depends_on:
      halodb:
        condition: service_healthy
    networks:
      halo_network:
    volumes:
      - ./halo2:/root/.halo2
    ports:
      - "8090:8090"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8090/actuator/health/readiness"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 30s
    environment:
      # JVM 参数，默认为 -Xmx256m -Xms256m，可以根据实际情况做调整，置空表示不添加 JVM 参数
      - JVM_OPTS=-Xmx256m -Xms256m
    command:
      - --spring.r2dbc.url=r2dbc:pool:mysql://halodb:3306/halo
      - --spring.r2dbc.username=root
      # MySQL 的密码，请保证与下方 MYSQL_ROOT_PASSWORD 的变量值一致。
      - --spring.r2dbc.password=o#DwN&JSa56
      - --spring.sql.init.platform=mysql
      # 外部访问地址，请根据实际需要修改
      - --halo.external-url=http://localhost:8090/

  halodb:
    image: mysql:8.1.0
    restart: on-failure:3
    networks:
      halo_network:
    command: 
      - --default-authentication-plugin=caching_sha2_password
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_general_ci
      - --explicit_defaults_for_timestamp=true
    volumes:
      - ./mysql:/var/lib/mysql
      - ./mysqlBackup:/data/mysqlBackup
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "--silent"]
      interval: 3s
      retries: 5
      start_period: 30s
    environment:
      # 请修改此密码，并对应修改上方 Halo 服务的 SPRING_R2DBC_PASSWORD 变量值
      - MYSQL_ROOT_PASSWORD=o#DwN&JSa56
      - MYSQL_DATABASE=halo

networks:
  halo_network:
```

#### halo + postgresql
```bash
version: "3"

services:
  halo:
    image: registry.fit2cloud.com/halo/halo:2.20
    restart: on-failure:3
    depends_on:
      halodb:
        condition: service_healthy
    networks:
      halo_network:
    volumes:
      - ./halo2:/root/.halo2
    ports:
      - "8090:8090"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8090/actuator/health/readiness"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 30s
    environment:
      # JVM 参数，默认为 -Xmx256m -Xms256m，可以根据实际情况做调整，置空表示不添加 JVM 参数
      - JVM_OPTS=-Xmx256m -Xms256m
    command:
      - --spring.r2dbc.url=r2dbc:pool:mysql://halodb:3306/halo
      - --spring.r2dbc.username=root
      # MySQL 的密码，请保证与下方 MYSQL_ROOT_PASSWORD 的变量值一致。
      - --spring.r2dbc.password=o#DwN&JSa56
      - --spring.sql.init.platform=mysql
      # 外部访问地址，请根据实际需要修改
      - --halo.external-url=http://localhost:8090/

  halodb:
    image: mysql:8.1.0
    restart: on-failure:3
    networks:
      halo_network:
    command: 
      - --default-authentication-plugin=caching_sha2_password
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_general_ci
      - --explicit_defaults_for_timestamp=true
    volumes:
      - ./mysql:/var/lib/mysql
      - ./mysqlBackup:/data/mysqlBackup
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "--silent"]
      interval: 3s
      retries: 5
      start_period: 30s
    environment:
      # 请修改此密码，并对应修改上方 Halo 服务的 SPRING_R2DBC_PASSWORD 变量值
      - MYSQL_ROOT_PASSWORD=o#DwN&JSa56
      - MYSQL_DATABASE=halo

networks:
  halo_network:
```

#### halo + h2
数据容易损坏, 不推荐
```bash
version: "3"

services:
  halo:
    image: registry.fit2cloud.com/halo/halo:2.20
    restart: on-failure:3
    volumes:
      - ./halo2:/root/.halo2
    ports:
      - "8090:8090"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8090/actuator/health/readiness"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 30s
    environment:
      # JVM 参数，默认为 -Xmx256m -Xms256m，可以根据实际情况做调整，置空表示不添加 JVM 参数
      - JVM_OPTS=-Xmx256m -Xms256m
    command:
      # 外部访问地址，请根据实际需要修改
      - --halo.external-url=http://localhost:8090/
```


### docker 部署
默认使用的是 h2 数据库, 不推荐
```bash
docker run -it -d --name halo -p 8090:8090 -v ~/.halo2:/root/.halo2 -e JVM_OPTS="-Xmx256m -Xms256m" registry.fit2cloud.com/halo/halo:2.20
```

### 1panel 部署
基于 linux 上部署 [1panel](https://1panel.cn/docs/installation/online_installation/) 服务器运维管理面板来部署 halo , 方便, 简单, ubuntu 部署, 跟着脚本部署, 全中文, 脚本中让切换镜像源, 不需要切换, docker 安装好, 应该也都有比较快速的国内镜像源
```bash
curl -sSL https://resource.fit2cloud.com/1panel/package/quick_start.sh -o quick_start.sh && sudo bash quick_start.sh
```

大概流程
```bash
root@aw:~# curl -sSL https://resource.fit2cloud.com/1panel/package/quick_start.sh -o quick_start.sh && sudo bash quick_start.sh
1panel-v1.10.29-lts-linux-amd64/1panel.service
1panel-v1.10.29-lts-linux-amd64/1pctl
1panel-v1.10.29-lts-linux-amd64/GeoIP.mmdb
1panel-v1.10.29-lts-linux-amd64/install.sh
1panel-v1.10.29-lts-linux-amd64/lang/en.sh
1panel-v1.10.29-lts-linux-amd64/lang/fa.sh
1panel-v1.10.29-lts-linux-amd64/lang/pt-BR.sh
1panel-v1.10.29-lts-linux-amd64/lang/ru.sh
1panel-v1.10.29-lts-linux-amd64/lang/zh.sh
1panel-v1.10.29-lts-linux-amd64/1panel
Select a language:
1. English
2. Chinese  中文(简体)
3. Persian
4. Português (Brasil)
5. Русский
Enter the number corresponding to your language choice: 2


 ██╗    ██████╗  █████╗ ███╗   ██╗███████╗██╗
███║    ██╔══██╗██╔══██╗████╗  ██║██╔════╝██║
╚██║    ██████╔╝███████║██╔██╗ ██║█████╗  ██║
 ██║    ██╔═══╝ ██╔══██║██║╚██╗██║██╔══╝  ██║
 ██║    ██║     ██║  ██║██║ ╚████║███████╗███████╗
 ╚═╝    ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝
[1Panel 2025-05-15 21:44:32 install Log]: ======================= 开始安装 =======================
设置1Panel安装目录 (默认为/opt): opt/1Panel
[1Panel 2025-05-15 21:44:42 install Log]: 请提供目录的完整路径
设置1Panel安装目录 (默认为/opt): /opt/1Panel
是否要配置镜像加速 [y/n]:  n
[1Panel 2025-05-15 21:44:49 install Log]: 未配置镜像加速。
[1Panel 2025-05-15 21:44:50 install Log]: Docker Compose已安装，跳过安装步骤
设置1Panel端口 (默认是 26098): 2000
[1Panel 2025-05-15 21:44:53 install Log]: 您设置的端口是:  2000
[1Panel 2025-05-15 21:44:53 install Log]: 正在打开防火墙端口 2000
Skipping adding existing rule
Skipping adding existing rule (v6)
Firewall not enabled (skipping reload)
设置1Panel安全入口 (默认是 f5a1f5b505): sec
[1Panel 2025-05-15 21:45:00 install Log]: 您设置的面板安全入口是 sec
设置1Panel面板用户 (默认是 e2c431b4dc): awaw
[1Panel 2025-05-15 21:45:03 install Log]: 您设置的面板用户是 awaw
[1Panel 2025-05-15 21:45:03 install Log]: 设置1Panel面板密码，设置后按回车键继续 (默认是 6af1a7de1b):
********
[1Panel 2025-05-15 21:45:07 install Log]: 正在配置1Panel服务
Created symlink /etc/systemd/system/multi-user.target.wants/1panel.service → /etc/systemd/system/1panel.service.
[1Panel 2025-05-15 21:45:07 install Log]: 正在启动1Panel服务
[1Panel 2025-05-15 21:45:08 install Log]:
[1Panel 2025-05-15 21:45:08 install Log]: =================感谢您的耐心等待，安装已完成==================
[1Panel 2025-05-15 21:45:08 install Log]:
[1Panel 2025-05-15 21:45:08 install Log]: 请使用您的浏览器访问面板:
[1Panel 2025-05-15 21:45:08 install Log]: 外部地址:  http://124.70.210.194:2000/sec
[1Panel 2025-05-15 21:45:08 install Log]: 内部地址:  http://192.168.3.95:2000/sec
[1Panel 2025-05-15 21:45:08 install Log]: 面板用户:  awaw
[1Panel 2025-05-15 21:45:08 install Log]: 面板密码:  asdfasdf
[1Panel 2025-05-15 21:45:08 install Log]:
[1Panel 2025-05-15 21:45:08 install Log]: 官方网站: https://1panel.cn
[1Panel 2025-05-15 21:45:08 install Log]: 项目文档: https://1panel.cn/docs
[1Panel 2025-05-15 21:45:08 install Log]: 代码仓库: https://github.com/1Panel-dev/1Panel
[1Panel 2025-05-15 21:45:08 install Log]: 前往 1Panel 官方论坛获取帮助: https://bbs.fit2cloud.com/c/1p/7
[1Panel 2025-05-15 21:45:08 install Log]:
[1Panel 2025-05-15 21:45:08 install Log]: 如果您使用的是云服务器，请在安全组中打开端口 2000
[1Panel 2025-05-15 21:45:08 install Log]:
[1Panel 2025-05-15 21:45:08 install Log]: 为了您的服务器安全，离开此屏幕后您将无法再次看到您的密码，请记住您的密码。
[1Panel 2025-05-15 21:45:08 install Log]:
[1Panel 2025-05-15 21:45:08 install Log]: ================================================================
```

#### OpenResty
镜像
```bash
services:
  openresty:
    image: 1panel/openresty:1.21.4.3-3-3-focal
    container_name: ${CONTAINER_NAME}
    restart: always
    network_mode: host
    volumes:
      - ./conf/nginx.conf:/usr/local/openresty/nginx/conf/nginx.conf
      - ./conf/fastcgi_params:/usr/local/openresty/nginx/conf/fastcgi_params
      - ./conf/fastcgi-php.conf:/usr/local/openresty/nginx/conf/fastcgi-php.conf
      - ./conf/mime.types:/usr/local/openresty/nginx/conf/mime.types
      - ./log:/var/log/nginx
      - ./conf/conf.d:/usr/local/openresty/nginx/conf/conf.d/
      - ./www:/www
      - ./root:/usr/share/nginx/html
      - /etc/localtime:/etc/localtime
      - ./1pwaf/data:/usr/local/openresty/1pwaf/data
    labels:
      createdBy: "Apps"
```

默认的端口是 80 和 443, 这是第一次部署的时候截下来的图, 后面部署改成了 81 和 444, 这个没用到, 直接 halo 配合 mysql 就可以运行, halo 也可以单独用镜像配置, 不需要数据库, 记得要时常在 halo 控制台备份数据
![[Pasted image 20250515214847.png]]

#### MySql
镜像
```bash
services:
  mysql:
    image: mysql:8.4.5
    container_name: ${CONTAINER_NAME}
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${PANEL_DB_ROOT_PASSWORD}
    networks:
      - 1panel-network
    ports:
      - ${PANEL_APP_PORT_HTTP}:3306
    volumes:
      - ./data/:/var/lib/mysql
      - ./conf/my.cnf:/etc/my.cnf
      - ./log:/var/log/mysql
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro
    labels:
      createdBy: "Apps"
    command:
      - --mysql-native-password=on
networks:
  1panel-network:
    external: true
```
![[Pasted image 20250515215153.png]]

#### halo
镜像
```bash
services:
  halo:
    image: halohub/halo-pro:2.20.20
    container_name: ${CONTAINER_NAME}
    restart: always
    networks:
      - 1panel-network
    volumes:
      - ./data:/root/.halo2
    ports:
      - ${PANEL_APP_PORT_HTTP}:8090
    healthcheck:
      test: [ "CMD", "curl", "-f", "http://localhost:8090/actuator/health/readiness" ]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 30s
    command:
      - --spring.r2dbc.url=r2dbc:pool:${PANEL_DB_TYPE}://${PANEL_DB_HOST}:${PANEL_DB_PORT}/${PANEL_DB_NAME}
      - --spring.r2dbc.username=${PANEL_DB_USER}
      - --spring.r2dbc.password=${PANEL_DB_USER_PASSWORD}
      - --spring.sql.init.platform=${PANEL_DB_TYPE}
      - --halo.external-url=${HALO_EXTERNAL_URL}
    environment:
      - JVM_OPTS=
    labels:
      createdBy: "Apps"
networks:
  1panel-network:
    external: true
```

这种直接在应用商店安装的不是 h2 数据库部署的, 是可选的数据库, 端口默认 8090, 设置成了 80, 端口外部访问也要打开, 构建容器运行状态
```bash
05879417125e   halohub/halo-pro:2.20.21              "sh -c 'java -Dreact…"   2 minutes ago    Up 2 minutes (healthy)      0.0.0.0:80->8090/tcp, :::80->8090/tcp   1Panel-halo-VbUg

```
![[Pasted image 20250516172156.png]]

注意不要在`网站`这个模块里面安装 halo 构建的站点, 这里构建的 halo 容器只有 127.0.0.1 可以访问
![[Pasted image 20250516171502.png]]
### 其他
#### dvwa
```bash
services:
  dvwa:
    image: ghcr.io/digininja/dvwa:latest
    container_name: ${CONTAINER_NAME}
    restart: always
    networks:
      - 1panel-network
    ports:
      - ${PANEL_APP_PORT_HTTP}:80
    environment:
      - DB_SERVER=${PANEL_DB_HOST}
      - DB_PORT=${PANEL_DB_PORT}
      - DB_DATABASE=${PANEL_DB_NAME}
      - DB_USER=${PANEL_DB_USER}
      - DB_PASSWORD=${PANEL_DB_USER_PASSWORD}
      - DEFAULT_SECURITY_LEVEL=${DVWA_SECURITY_LEVEL}
      - RECAPTCHA_PUBLIC_KEY=${DVWA_RECAPTCHA_PUBLIC_KEY}
      - RECAPTCHA_PRIVATE_KEY=${DVWA_RECAPTCHA_PRIVATE_KEY}
      - DEFAULT_LOCALE=${DVWA_DEFAULT_LOCALE}
    labels:
      createdBy: "Apps"
networks:
  1panel-network:
    external: true
```

#### wordpress
```bash
services:
  wordpress:
    image: wordpress:6.8.1
    container_name: ${CONTAINER_NAME}
    ports:
      -  ${PANEL_APP_PORT_HTTP}:80
    restart: always
    networks:
      - 1panel-network
    volumes:
      - ./data:/var/www/html
      - ./conf/uploads.ini:/usr/local/etc/php/conf.d/uploads.ini
    environment:
      WORDPRESS_DB_HOST: ${PANEL_DB_HOST}:${PANEL_DB_PORT}
      WORDPRESS_DB_NAME: ${PANEL_DB_NAME}
      WORDPRESS_DB_USER: ${PANEL_DB_USER}
      WORDPRESS_DB_PASSWORD: ${PANEL_DB_USER_PASSWORD}
      WORDPRESS_DEBUG: 0
    labels:
      createdBy: "Apps"
networks:
  1panel-network:
    external: true
```


#### adminer
```bash
services:  
  adminer:  
    image: adminer:5.2.1-standalone 
    container_name: ${CONTAINER_NAME}
    restart: always  
    networks:  
      - 1panel-network
    ports:  
      - ${PANEL_APP_PORT_HTTP}:8080  
    labels:  
      createdBy: "Apps"  
networks:  
  1panel-network:  
    external: true
```