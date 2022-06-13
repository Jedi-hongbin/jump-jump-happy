/*
 * @Author: hongbin
 * @Date: 2022-06-13 19:40:04
 * @LastEditors: hongbin
 * @LastEditTime: 2022-06-13 21:14:23
 * @Description: 适用于本项目的助手函数
 */

const axisArr = ['x', 'y', 'z'];
/**
* 随机从 x,y,z轴中选一个方向
*/
export function randomAxis() {
    return axisArr[Math.floor(Math.random() * 3)];
    // return 'x';
}