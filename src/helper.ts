import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";

/*
 * @Author: hongbin
 * @Date: 2022-06-13 19:40:04
 * @LastEditors: hongbin
 * @LastEditTime: 2022-06-17 15:24:35
 * @Description: 适用于本项目的助手函数
 */
export type positionAxis = "x" | "y" | "z";

const axisArr: positionAxis[] = ["x", "y", "z"];
/**
 * 随机从 x,y,z轴中选一个方向
 */
export function randomAxis(): positionAxis {
    return axisArr[Math.floor(Math.random() * 3)];
    // return 'x';
}

/**
 * @description: 对象的某属性 逐帧变换
 * @param {*} mash 独享
 * @param {*} prop 属性
 * @param {*} valRegion 变化区间
 * @param {*} paragraph 分多少段完成变换
 * @param {*} onComplete 执行完回掉函数
 * @return {*}
 */
export const animationFrameTrans = (
    mash: THREE.Material,
    prop: Omit<keyof THREE.Material, "isMaterial">,
    valRegion = [0, 1],
    paragraph = 10,
    onComplete: () => any = () => {}
) => {
    const diff = valRegion[1] - valRegion[0];
    const count = diff / paragraph;
    //@ts-ignore
    mash[prop] = valRegion[0];

    const tick = () => {
        //@ts-ignore
        mash[prop] += count;
        //@ts-ignore
        if (mash[prop] <= valRegion[1]) {
            requestAnimationFrame(tick);
        } else onComplete && onComplete();
    };
    tick();
};

export type Intersection = THREE.Intersection<THREE.Object3D<THREE.Event>>[];

/**
 * @description:  传入角度即方向 判断附近有没有障碍物 返回是否有碰撞或返回障碍物
 * @param {controls} controls  控制器
 * @param {objects} objects  碰撞检测的对象
 * @param {eyeHeight} eyeHeight  眼睛的高度 决定是脚底或是头部或事腰部 任意高度
 * @param {angle} angle  射线旋转角度 决定前后左右
 * @param {far} far  检测的距离
 * @return  Object3D[]
 */
export const collideCheck = (
    controls: PointerLockControls,
    objects: THREE.Object3D[],
    eyeHeight: number,
    angle: number,
    far: number = 5
) => {
    let rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeRotationY((angle * Math.PI) / 180);
    //返回摄像机的观看方向
    const cameraDirection = controls.getDirection(new THREE.Vector3(0, 0, 0)).clone();
    //将该向量乘以四阶矩阵m（第四个维度隐式地为1），并按角度进行划分。
    cameraDirection.applyMatrix4(rotationMatrix);

    const raycaster = new THREE.Raycaster(
        controls.getObject().position.clone(),
        cameraDirection,
        0,
        far
    );
    raycaster.ray.origin.y -= eyeHeight;
    const intersections = raycaster.intersectObjects(objects, false);
    // intersections.length && console.log(intersections[0].object.userData.index);
    return intersections;
};

// const around = {
//     forward: { axis: "z", vector: 1, angle: 0 },
//     backward: { axis: "z", vector: -1, angle: 180 },
//     left: { axis: "x", vector: -1, angle: 90 },
//     right: { axis: "x", vector: 1, angle: 270 },
// };

// controls: PointerLockControls,
// objects: THREE.Object3D[],
// eyeHeight: number

/**
 * @description: 检测四周有没有被碰撞--区别于按下判断一次对应一侧 只是贴身的碰撞被推着走
 * @return {*}
 */
export function checkAllAroundCollide(
    collideCollideBlocks: Set<number>,
    ...rest: [PointerLockControls, THREE.Object3D[], number]
) {
    for (let angle = 0; angle <= 3; angle++) {
        const object = collideCheck(...rest, angle * 90, 4);
        object.length && collideCollideBlocks.add(object[0].object.userData.index);
    }
}

export const randomColor = () =>
    `#${Math.floor(Math.random() * 0xffffff)
        .toString(16)
        .padEnd(6, (Math.random() * 10).toString(16)[0])}`;
