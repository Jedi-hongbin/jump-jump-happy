server 目录为 node 部署

```bash
yarn init

yarn dev
```

TODO

2022-06-12

> 砖块加入自动移动动画后 人在砖块上应该随着砖块移动而移动 目前砖块下落人会不动然后超出 10 掉落
> 方案:站在砖块上获取砖块每一帧移动速度和方向 更改人物的位置

> 站在砖块 1 上跟随 1 移动 这时砖块 2 过来产生碰撞 同时被 2 顶着移动
> 即便站在原地 砖块撞过来的 需要被砖块顶着产生位移
> ： 获取碰撞的物体 如果是砖块正在移动 设置 controls 的 position 产生被顶着走的感觉
