/*
 * @Author: hongbin
 * @Date: 2022-06-13 19:40:04
 * @LastEditors: hongbin
 * @LastEditTime: 2022-06-13 22:03:29
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
