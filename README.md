# GKerLove-chat

果壳之恋聊天服务器项目

## 运行

安装依赖：

```shell
npm install
```

开发环境启动服务器：

```shell
npm run start:dev
```

生成环境启动服务器：

```shell
npm run start
```

打包：

```shell
npm run build
```

## 配置

项目配置在*config.ts*。

采用环境变量的方式进行配置，需要提供数据库（*MongoDB*）连接地址、用户名、密码、认证数据库、项目的*jwtScret*（需要与后端服务器一致）。

## 项目结构

聊天服务器主要处理客户端和服务器端的双向通信。首先在*types/socket.io.ts*中添加*ServerToClientEvents*和*ClientToServerEvents*，约定服务器和客户端之间的通信方式。在*handlers*文件下，编写处理器处理客户端事件，在处理器中可以使用*callback*对客户端进行回调，告知客户端事件已被服务器处理。可以使用*socket*对象和*io*对象向客户端发送事件。

*models*文件夹下是数据库的模型，用于与数据库交互。
