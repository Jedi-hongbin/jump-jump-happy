import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import fontJSON from "../static/font/JJHappy.json";
import {
    positionAxis,
    randomAxis,
    animationFrameTrans,
    collideCheck,
    checkAllAroundCollide,
    randomColor,
} from "./helper";

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
let upRaycaster: THREE.Raycaster;
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
 * 当前产生碰撞的砖块数组
 */
let collideCollideBlocks = new Set() as Set<number>;
/**
 * 脚下踩着的砖块
 */
let blockUnderFoot = -1;
//开启测试模式 默认开启
let testMode = true;

const helloTexture = {
    map: new THREE.TextureLoader().load("img/hello/hello.jpg", () =>
        renderer.render(scene, camera)
    ),
    normalMap: new THREE.TextureLoader().load("img/hello/NormalMap.png", () =>
        renderer.render(scene, camera)
    ),
    specularMap: new THREE.TextureLoader().load("img/hello/SpecularMap.png", () =>
        renderer.render(scene, camera)
    ),
    aoMap: new THREE.TextureLoader().load("img/hello/AmbientOcclusionMap.png", () =>
        renderer.render(scene, camera)
    ),
};
const wallTexture = {
    map: new THREE.TextureLoader().load("img/wall/wall.jpg", () =>
        renderer.render(scene, camera)
    ),
    normalMap: new THREE.TextureLoader().load("img/wall/NormalMap.png", () =>
        renderer.render(scene, camera)
    ),
    specularMap: new THREE.TextureLoader().load("img/wall/SpecularMap.png", () =>
        renderer.render(scene, camera)
    ),
    aoMap: new THREE.TextureLoader().load("img/wall/AmbientOcclusionMap.png", () =>
        renderer.render(scene, camera)
    ),
};
const stoneTexture = {
    map: new THREE.TextureLoader().load("img/stone/stone.png", () =>
        renderer.render(scene, camera)
    ),
    normalMap: new THREE.TextureLoader().load("img/stone/NormalMap.png", () =>
        renderer.render(scene, camera)
    ),
    specularMap: new THREE.TextureLoader().load("img/stone/SpecularMap.png", () =>
        renderer.render(scene, camera)
    ),
    aoMap: new THREE.TextureLoader().load("img/stone/AmbientOcclusionMap.png", () =>
        renderer.render(scene, camera)
    ),
    displacementMap: new THREE.TextureLoader().load("img/stone/DisplacementMap.png", () =>
        renderer.render(scene, camera)
    ),
};

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

function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xceefcc);
    scene.fog = new THREE.Fog(0xcffecc, 0, 2000);
    const axesHelper = new THREE.AxesHelper(500);
    scene.add(axesHelper);
}

function initLight() {
    /**
     * 半球光
     */
    const light = new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.75);
    light.position.set(0.5, 1, 0.75);
    scene.add(light);
}

/**
 * 初始化透视相机
 */
function initCamera() {
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        1,
        2000
    );
}

/**
 * 指针锁定控制器 https://threejs.org/docs/index.html?q=cont#examples/zh/controls/PointerLockControls
 * 锁定鼠标api https://developer.mozilla.org/zh-CN/docs/Web/API/Pointer_Lock_API
 */
function initContrils() {
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
}

function initKeyPressListen() {
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
}

function initRaycaster() {
    //方向朝下的射线 检测脚底
    raycaster = new THREE.Raycaster(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -1, 0),
        0,
        //只投射3个单位距离
        10
    );
    //方向朝上的射线 检测头顶
    upRaycaster = new THREE.Raycaster(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 1, 0),
        0,
        //投射距离要恰当 否则跳落下时加上射线的高度都会满足碰撞的条件 多次触发处理方法
        2
    );
}

function addFloor() {
    // 地面
    let floorGeometry = new THREE.PlaneGeometry(2000, 2000, 2, 2);
    floorGeometry.rotateX(-Math.PI / 2);

    const floorMaterial = new THREE.MeshBasicMaterial({ color: 0xcfffcc });

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    scene.add(floor);
}

function creatBox(width: number | undefined, height: number | undefined) {
    const boxGeometry = new THREE.BoxGeometry(width, height, 80).toNonIndexed();
    const isHelloTexture = Math.random() > 0.5;
    // const boxMaterial = new THREE.MeshPhongMaterial({
    const boxMaterial = new THREE.MeshPhongMaterial({
        specular: 0xffffff,
        // color: randomColor(),
        color: 0xffffff,
        flatShading: true,
        // vertexColors: true,
        //允许透明并且设置透明度
        transparent: true,
        opacity: 0.3,
        ...(isHelloTexture ? helloTexture : stoneTexture),
        displacementBias: 1,
        displacementScale: 1,
        // map: isHelloTexture ? helloTexture : wallTexture,
        // normalMap: isHelloTexture ? helloNormalMap : wallNormalMap,
        // specularMap: SpecularMap,
        // aoMap: AmbientOcclusionMap,
    });

    return new THREE.Mesh(boxGeometry, boxMaterial);
}

/**
 * 生成台阶🧱
 */
function genBlock() {
    const half = blockCounts / 2;
    const height = 10;
    const width = 50;

    /**
     * 返回砖块坐标
     */
    const getPosition = (i: number) => {
        // const top = 10 * (i <= half ? half - i : i);
        // const x = width * (i > half ? i - blockCounts : i) + i * 30 - 800;
        // const y = top / 2;
        // const z = i * (8 + (Math.random() - 0.5) * 5);
        const top = i;
        const x = Math.sin((Math.PI / 180) * i * 20) * 200;
        const y = i * 10;
        const z = Math.cos((Math.PI / 180) * i * 20) * 200;
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
    scene.add(...blocks);
    objects.push(...blocks);

    halfPoint = getPosition(0);
    startPoint = getPosition(half);
    endPoint = blocks[blockCounts].position;

    camera.position.set(120, 800, -300);
    // camera.position.set(endPoint.x, endPoint.y + 20, endPoint.z);
    // camera.position.set(
    //     startPoint.x,
    //     startPoint.y + startPoint.top + 20,
    //     startPoint.z
    // );
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
    /**
     * 最后一块砖上显示成功文字 位置在生成砖块时生成 由最后一块砖的位置决定位置
     */
    successText = createSuccessInfo();
    successText.rotation.y = Math.PI / -2;
    successText.userData.index = "过关";
    objects.push(successText);
    scene.add(successText);
    successText.position.set(endPoint.x + 20, endPoint.y + 20, endPoint.z - 20);
    // successText.translateY(10 * blockCounts);
}

function initRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    //!不加颜色变暗
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.body.appendChild(renderer.domElement);

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener("resize", onWindowResize);
    //先渲染一次 有个基础画面
    render();
}

function render() {
    renderer.render(scene, camera);
}

function init() {
    initScene();
    initLight();
    initCamera();
    initContrils();
    initRaycaster();
    initKeyPressListen();

    addFloor();
    genBlock();

    //视线往哪看
    // camera.lookAt(successText.position);
    camera.lookAt(halfPoint.x, halfPoint.y, halfPoint.z);
    initRenderer();
}

const direction = new THREE.Vector3();

/**
 * 每一帧执行的操作 -- 核心代码
 */
function animate() {
    animationFrame = requestAnimationFrame(animate);

    const time = performance.now();
    if (controls.isLocked === true) {
        //四个方位是否产生碰撞
        let leftCollide = 0;
        let rightCollide = 0;
        let forwardCollide = 0;
        let backCollide = 0;
        /**
         * 碰撞检测 collide check
         * 需要检测头和脚又一方有障碍碰撞 则不能前进
         */
        if (moveForward)
            forwardCollide =
                collideCheck(controls, objects, eyeHeight, 0).length ||
                collideCheck(controls, objects, -2, 0).length;
        if (moveBackward)
            backCollide =
                collideCheck(controls, objects, eyeHeight, 180).length ||
                collideCheck(controls, objects, -2, 180).length;
        if (moveLeft)
            leftCollide =
                collideCheck(controls, objects, eyeHeight, 90).length ||
                collideCheck(controls, objects, -2, 90).length;
        if (moveRight)
            rightCollide =
                collideCheck(controls, objects, eyeHeight, 270).length ||
                collideCheck(controls, objects, -2, 270).length;

        //检测有没有和砖块碰撞 有则被“顶开”

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
        //检测脚下
        fall();
        //检测四周 身体的三分之一 三分之二高度 两个四周射线 检测
        checkAllAroundCollide(collideCollideBlocks, controls, objects, eyeHeight / 3);
        checkAllAroundCollide(collideCollideBlocks, controls, objects, eyeHeight / 1.5);
        checkAllAroundCollide(collideCollideBlocks, controls, objects, eyeHeight / 2);
        collideCollideBlocks.size && collideCollideBlocks.forEach(console.log);
        /**
         * 砖块运动
         */
        blocks.forEach((block) => {
            let { prevPosition, speed, dir, axis, index } = block.userData as {
                axis: positionAxis;
            } & Record<string, any>;
            if (index === blockCounts) return;
            const isOver = dir * (block.position[axis] - prevPosition[axis]) > 60;
            if (isOver) {
                block.userData.dir *= -1;
                dir *= -1;
            }
            const dis = dir * speed * 100 * delta;
            block.position[axis] += dis;
            //如果脚下踩的是这块砖 跟着砖走
            //站在砖上 跟着砖移动 需要移动相机而不是左右(moveRight) 左右并不对于x,z轴
            if (blockUnderFoot === index) {
                camera.position[axis] += dis;
            }
            //与砖块碰撞
            else if (collideCollideBlocks.has(index)) {
                // console.log(index, axis);
                //砖块移动方向碰撞被"弹开" 另外方向 阻止移动 就不会进入其他物体内部
                const blockAxis = block.getWorldPosition(new THREE.Vector3())[axis];
                const cameraAxis = camera.getWorldPosition(new THREE.Vector3())[axis];
                //对应砖块的移动方向
                //根据物体河相机的posituon 确定谁在谁的哪一侧 物体在右边 则向左推允许 回到右边人不跟随移动

                if (dir * blockAxis < dir * cameraAxis) {
                    camera.position[axis] += dis;
                }
            }
        });

        //加速级别
        const quicken = pressShift ? 7 : 1;
        //计算移动距离
        let rightDistance = -velocity.x * delta * quicken;
        let forwardDistance = -velocity.z * delta * quicken;
        //右侧有障碍物时向右移动 置零
        if ((moveRight && rightCollide) || (moveLeft && leftCollide)) {
            rightDistance = 0;
        }
        //前方有障碍物时向前移动 置零
        if ((moveForward && forwardCollide) || (moveBackward && backCollide)) {
            forwardDistance = 0;
        }

        //设置最终移动值 左右并不对应x，z轴
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

    render();
}

/**
 * 检测下落 即站在砖块上触发
 */
function fall() {
    collideCollideBlocks.clear();
    blockUnderFoot = -1;
    /**
     * 射线原点是相机位置  但是 要从脚下开始算 所以 y轴 -10
     * 判断前面有没有
     */
    raycaster.ray.origin.copy(controls.getObject().position);
    raycaster.ray.origin.y -= eyeHeight;
    upRaycaster.ray.origin.copy(controls.getObject().position);
    //需要一点距离 不然贴上了才知道会穿过障碍物
    upRaycaster.ray.origin.y += 1;
    //脚下
    const intersections = raycaster.intersectObjects(objects, false);
    const onObject = intersections.length;
    //头上
    const headIntersections = upRaycaster.intersectObjects(objects, false);
    const upCollide = headIntersections.length;

    //如果头上有障碍
    if (upCollide) {
        // const object = headIntersections[0].object;
        // console.log(performance.now() - object.userData.prevUpCollide);

        // if (performance.now() - object.userData.prevUpCollide < 500)
        //     return console.log("卧槽");
        // object.userData.prevUpCollide = performance.now();
        velocity.y *= -1;
        console.log("aa");
    }

    //如果下方没有物体不处理
    if (!onObject) return;
    const object = intersections[0].object as THREE.Mesh<THREE.BufferGeometry>;
    const {
        userData: { opacity, index },
        material,
    } = object;
    blockUnderFoot = index;
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
