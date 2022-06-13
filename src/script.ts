import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import TWEEN from "@tweenjs/tween.js";
import fontJSON from "../static/font/JJHappy.json";
import { positionAxis, randomAxis } from "./helper";
import { BufferGeometry } from "three";

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("draco/");
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

let camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    controls: PointerLockControls;
let startPoint, endPoint, halfPoint: { x: any; y: any; z: any; top?: number };
const fontLoad = new FontLoader();
const font = fontLoad.parse(fontJSON);
const objects: THREE.Object3D[] = [];

let raycaster: THREE.Raycaster;
let alreadyPass = false;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
/**
 * iframe id
 */
let animationFrame: number;
/**
 * 按下shift键加速
 */
let pressShift = false;
let canJump = false;
/**
 * 成功过关的文字提示
 */
let successText: THREE.Mesh<TextGeometry, THREE.MeshPhongMaterial[]>;
/**
 * 砖块数量
 */
const blockCounts = 40;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const color = new THREE.Color();
/**
 * 跳跃高度
 */
const JumpHeight = 300;
/**
 * 眼睛位置
 */
const eyeHeight = 10;
/**
 * 砖块的集合
 */
let blocks: THREE.Object3D[] = [];
/**
 * 当前脚下的砖块
 */
let currentBlockIndex = -1;
//开启测试模式 默认开启
let testMode = true;

init();

function createTitle() {
    const textGeo = new TextGeometry("提示: 善用加速和二段跳可抵达更远处", {
        font,
        size: 4,
        height: 2,
        curveSegments: 0.2,
        bevelThickness: 0.1,
        bevelSize: 0.1,
        bevelEnabled: true,
    });
    const materials = [
        new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true }), // front
        new THREE.MeshPhongMaterial({ color: 0xffffff }), // side
    ];
    const textMesh = new THREE.Mesh(textGeo, materials);
    return textMesh;
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
const animationFrameTrans = (
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

function createSuccessInfo() {
    const textGeo = new TextGeometry("过关", {
        font,
        size: 15,
        height: 4,
        curveSegments: 0.5,
        bevelThickness: 0.5,
        bevelSize: 0.5,
        bevelEnabled: true,
    });
    const materials = [
        new THREE.MeshPhongMaterial({ color: 0xa030ff, flatShading: true }), // front
        new THREE.MeshPhongMaterial({ color: 0x5511ff }), // side
    ];
    materials.forEach((m) => {
        m.transparent = true;
        m.opacity = 0.3;
    });
    const textMesh = new THREE.Mesh(textGeo, materials);
    return textMesh;
}

function init() {
    /**
     * 透视相机
     */
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        1,
        2000
    );

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xceefcc);
    // scene.fog = new THREE.Fog(0xcffecc, 0, 2000);

    const axesHelper = new THREE.AxesHelper(500);
    scene.add(axesHelper);

    /**
     * 半球光
     */
    const light = new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.75);
    light.position.set(0.5, 1, 0.75);
    scene.add(light);
    /**
     * 指针锁定控制器 https://threejs.org/docs/index.html?q=cont#examples/zh/controls/PointerLockControls
     * 锁定鼠标api https://developer.mozilla.org/zh-CN/docs/Web/API/Pointer_Lock_API
     */
    controls = new PointerLockControls(camera, document.body);

    const blocker = document.getElementById("blocker") as HTMLElement;
    const instructions = document.getElementById("instructions") as HTMLElement;

    instructions.addEventListener("click", function () {
        controls.lock();
    });

    controls.addEventListener("lock", function () {
        instructions.style.display = "none";
        blocker.style.display = "none";
        animate();
    });

    controls.addEventListener("unlock", function () {
        if (alreadyPass) {
            const passLevel = document.querySelector("#passLevel") as HTMLElement;
            passLevel.style["top"] = "0";
        } else {
            blocker.style.display = "block";
            instructions.style.display = "";
            //取消 逐帧执行
            cancelAnimationFrame(animationFrame);
        }
    });

    scene.add(controls.getObject());

    /**
     * 上帝视角
     */
    // camera.position.set(343, 624, 313);

    const onKeyDown = function (event: { code: any }) {
        switch (event.code) {
            case "ArrowUp":
            case "KeyW":
                moveForward = true;
                break;

            case "ArrowLeft":
            case "KeyA":
                moveLeft = true;
                break;

            case "ArrowDown":
            case "KeyS":
                moveBackward = true;
                break;

            case "ArrowRight":
            case "KeyD":
                moveRight = true;
                break;
            case "ShiftLeft":
            case "ShiftRIGHT":
                pressShift = true;
                break;
            case "KeyT":
                testMode = true;
                break;

            case "Space":
                //可以跳的时候跳 y轴增加 开始跳跃时将可以跳跃状态设置为false
                if (testMode || canJump === true) velocity.y += JumpHeight;
                canJump = false;
                break;
        }
    };

    const onKeyUp = function (event: { code: any }) {
        switch (event.code) {
            case "ArrowUp":
            case "KeyW":
                moveForward = false;
                break;

            case "ArrowLeft":
            case "KeyA":
                moveLeft = false;
                break;

            case "ArrowDown":
            case "KeyS":
                moveBackward = false;
                break;

            case "ArrowRight":
            case "KeyD":
                moveRight = false;
                break;
            case "ShiftLeft":
            case "ShiftRIGHT":
                pressShift = false;
                break;
        }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    raycaster = new THREE.Raycaster(
        new THREE.Vector3(),
        new THREE.Vector3(0, -1, 0),
        0,
        //只投射10距离 判断近距离的射线
        10
    );

    // 地面
    let floorGeometry = new THREE.PlaneGeometry(2000, 2000, 2, 2);
    floorGeometry.rotateX(-Math.PI / 2);

    const floorMaterial = new THREE.MeshBasicMaterial({ color: 0xcfffcc });

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    scene.add(floor);

    const creatBox = (width: number | undefined, height: number | undefined) => {
        const boxGeometry = new THREE.BoxGeometry(width, height, 80).toNonIndexed();

        let position = boxGeometry.attributes.position;
        const colorsBox = [];

        for (let i = 0, l = position.count; i < l; i++) {
            color.setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75);
            colorsBox.push(color.r, color.g, color.b);
        }

        boxGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colorsBox, 3));
        // objects
        //toNonIndexed 返回已索引的 BufferGeometry 的非索引版本。
        const boxMaterial = new THREE.MeshPhongMaterial({
            specular: 0xffffff,
            flatShading: true,
            vertexColors: true,
            //允许透明并且设置透明度
            transparent: true,
            opacity: 0.3,
        });
        boxMaterial.color.setHSL(
            Math.random() * 0.75 + 0.25,
            Math.random() * 0.95,
            Math.random() * 0.75 + 0.25
        );

        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        return box;
    };

    /**
     * 最后一块砖上显示成功文字 位置在生成砖块时生成 由最后一块砖的位置决定位置
     */
    successText = createSuccessInfo();
    successText.rotation.y = Math.PI / -2;
    successText.userData.index = "过关";
    objects.push(successText);
    scene.add(successText);
    /**
     * 通天塔阶台阶🧱
     */
    const genBlock = () => {
        const half = blockCounts / 2;
        const height = 10;
        const width = 50;

        /**
         * 返回砖块坐标
         */
        const getPosition = (i: number) => {
            const top = 10 * (i <= half ? half - i : i);
            const x = width * (i > half ? i - blockCounts : i) + i * 30 - 800;
            const y = top / 2;
            const z = i * (8 + (Math.random() - 0.5) * 5);
            return { x, y, z, top };
        };

        for (let i = 0; i <= blockCounts; i++) {
            const box = creatBox(width, height);
            const { x, y, z, top } = getPosition(i);
            box.position.set(x, y, z);
            box.translateY(top);
            box.userData = {
                index: i,
                prevPosition: box.position.clone(),
                speed: Math.random(),
                dir: Math.random() - 0.5 > 0 ? 1 : -1,
                axis: randomAxis(),
            };
            blocks.push(box);
        }
        halfPoint = getPosition(0);
        startPoint = getPosition(half);
        endPoint = blocks[blockCounts].position;

        // camera.position.set(endPoint.x, endPoint.y + 20, endPoint.z);
        camera.position.set(
            startPoint.x,
            startPoint.y + startPoint.top + 20,
            startPoint.z
        );
        /**
         * 第一阶段最终砖块 显示提示文字
         */
        //文字也可以踩
        const title = createTitle();
        title.position.set(halfPoint.x - 20, halfPoint.y + 40, halfPoint.z + 50);
        title.translateY(10 * half);
        title.rotation.y = Math.PI / 2;
        title.userData.index = "踩提示文字上了";
        objects.push(title);
        scene.add(title);
        successText.position.set(endPoint.x + 20, endPoint.y + 20, endPoint.z - 20);
        // successText.translateY(10 * blockCounts);
    };
    genBlock();
    scene.add(...blocks);
    objects.push(...blocks);
    //视线往哪看
    // camera.lookAt(successText.position);
    camera.lookAt(halfPoint.x, halfPoint.y, halfPoint.z);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    //!不加颜色变暗
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.body.appendChild(renderer.domElement);

    window.addEventListener("resize", onWindowResize);
    //先渲染一次 有个基础画面
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * 传入角度即方向 判断附近有没有障碍物 返回是否有碰撞 ~~返回障碍物数量~~
 */
const collideCheck = (angle: number) => {
    let rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeRotationY((angle * Math.PI) / 180);
    const cameraDirection = controls.getDirection(new THREE.Vector3(0, 0, 0)).clone();
    cameraDirection.applyMatrix4(rotationMatrix);
    const raycaster = new THREE.Raycaster(
        controls.getObject().position.clone(),
        cameraDirection,
        0,
        5
    );
    raycaster.ray.origin.y -= eyeHeight;
    const intersections = raycaster.intersectObjects(objects, false);
    // intersections.length && console.log(intersections[0].object.userData.index);
    return !!intersections.length;
};

const direction = new THREE.Vector3();

function animate() {
    animationFrame = requestAnimationFrame(animate);
    TWEEN.update();
    const time = performance.now();
    if (controls.isLocked === true) {
        /**
         * 射线原点是相机位置  但是 要从脚下开始算 所以 y轴 -10
         * 判断前面有没有
         */
        raycaster.ray.origin.copy(controls.getObject().position);
        raycaster.ray.origin.y -= eyeHeight;

        //四个方位是否产生碰撞
        let leftCollide = false;
        let rightCollide = false;
        let forwardCollide = false;
        let backCollide = false;
        /**
         * 碰撞检测 collide check
         * 未检查头部碰撞
         */
        if (moveForward) forwardCollide = collideCheck(0);
        if (moveBackward) backCollide = collideCheck(180);
        if (moveLeft) leftCollide = collideCheck(90);
        if (moveRight) rightCollide = collideCheck(270);
        //根据boolean值 巧妙判断方向 决定下面移动的值
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // 确保各个方向的一致运动

        //每一帧的间隔时间 保证相同时间移动相同距离
        const delta = (time - prevTime) / 1000;

        //计算正常移动距离排除影响因素
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 5.8 * 100.0 * delta;

        //按下了前/后
        if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
        //按下了左/右
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

        fall();

        /**
         * 砖块运动
         */
        blocks.forEach((block) => {
            let { prevPosition, speed, dir, axis, index } = block.userData as {
                axis: positionAxis;
            } & Record<string, any>;
            if (index === blockCounts) return;

            if (dir * (block.position[axis] - prevPosition[axis]) > 60) {
                block.userData.dir *= -1;
                dir *= -1;
            }
            const dis = dir * speed * 100 * delta;
            block.position[axis] += dis;
            //如果脚下踩的是这块砖 跟着砖走
            if (currentBlockIndex === index) {
                //站在砖上 跟着砖移动 需要移动相机而不是左右(moveRight) 左右并不对于x,z轴
                //TODO 有障碍物的情况 阻止移动
                controls.getObject().position[axis] += dis;
            }
        });

        //加速级别
        const quicken = pressShift ? 7 : 1;
        //计算移动距离
        let rightDistance = -velocity.x * delta * quicken;
        let forwardDistance = -velocity.z * delta * quicken;
        //右侧有障碍物时向右移动 置零
        if (
            (moveRight && rightCollide) ||
            (moveLeft && leftCollide) ||
            (!moveLeft && !moveRight)
        ) {
            rightDistance = 0;
        }
        //前方有障碍物时向前移动 置零
        if ((moveForward && forwardCollide) || (moveBackward && backCollide)) {
            forwardDistance = 0;
        }

        //设置最终移动值
        if (moveLeft || moveRight) controls.moveRight(rightDistance);

        if (moveForward || moveBackward) controls.moveForward(forwardDistance);
        //移动相机的位置
        controls.getObject().position.y += velocity.y * delta;

        //保障y轴最小为eyeHeight 而不是贴近地面
        if (controls.getObject().position.y < eyeHeight) {
            velocity.y = 0;
            controls.getObject().position.y = eyeHeight;
            canJump = true;
        }
    }

    prevTime = time;

    renderer.render(scene, camera);
}

/**
 * 检测下落 即站在砖块上触发
 */
function fall() {
    const intersections = raycaster.intersectObjects(objects, false);
    const onObject = intersections.length;
    currentBlockIndex = -1;
    //如果下方没有物体不处理
    if (!onObject) return;
    const object = intersections[0].object as THREE.Mesh<BufferGeometry>;
    const {
        userData: { opacity, index },
        material,
    } = object;
    currentBlockIndex = index;
    velocity.y = Math.max(0, velocity.y);

    //可以起跳
    canJump = true;

    //踩到的砖块变实
    if (!opacity) {
        object.userData.opacity = true;
        animationFrameTrans(material as THREE.Material, "opacity", [0.3, 1], 10);
    }

    //显示过关文字
    if (index === blockCounts) {
        !alreadyPass &&
            successText &&
            successText.material.forEach((m: any) => {
                animationFrameTrans(m, "opacity", [0, 1], 50);
            });
        setTimeout(() => {
            controls.unlock();
        }, 2300);
        alreadyPass = true;
    }
}

document.querySelector("#restart")!.addEventListener("click", () => {
    window.location.reload();
});

document.querySelector("#next")!.addEventListener("click", () => {
    alert("开发中。。。");
});

// function rotateCameraToObject(object3D, time) {
//     var cameraPosition = camera.position.clone(); // camera original position
//     var cameraRotation = camera.rotation.clone(); // camera original rotation
//     var cameraQuaternion = camera.quaternion.clone(); // camera original quaternion
//     var dummyObject = new THREE.Object3D(); // dummy object
//     // set dummyObject's position, rotation and quaternion the same as the camera
//     dummyObject.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
//     dummyObject.rotation.set(cameraRotation.x, cameraRotation.y, cameraRotation.z);
//     dummyObject.quaternion.set(cameraQuaternion.x, cameraQuaternion.y, cameraQuaternion.z);
//     // lookAt object3D
//     // dummyObject.lookAt(object3D.position);
//     // dummyObject.lookAt(object3D.position);
//     // store its quaternion in a variable
//     var targetQuaternion = dummyObject.quaternion.clone();
//     // tween start object
//     var tweenStart = {
//         x: cameraQuaternion.x,
//         y: cameraQuaternion.y,
//         z: cameraQuaternion.z,
//         w: cameraQuaternion.w
//     };
//     //tween target object
//     var tweenTarget = {
//         x: targetQuaternion.x,
//         y: targetQuaternion.y,
//         z: targetQuaternion.z,
//         w: targetQuaternion.w
//     };
//     // tween stuff
//     var tween = new TWEEN.Tween(tweenStart).to(tweenTarget, time);
//     tween.onUpdate(function () {
//         camera.quaternion.x = tweenStart.x;
//         camera.quaternion.y = tweenStart.y;
//         camera.quaternion.z = tweenStart.z;
//         camera.quaternion.w = tweenStart.w;
//     });
//     tween.start();
// }
