import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader";
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import fontJSON from "../static/font/JJHappy.json";

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('draco/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

let camera, scene, renderer, controls;
const fontLoad = new FontLoader();
const font = fontLoad.parse(fontJSON);
const objects = [];

let raycaster;
let alreadyPass = false;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
/**
* iframe id
*/
let animationFrame = null;
/**
* 按下shift键加速
*/
let pressShift = false;
let canJump = false;
/**
* 成功过关的文字提示
*/
let successText;
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

let blocks = [];

init();

function createTitle() {
    const textGeo = new TextGeometry('提示: 善用加速和二段跳可抵达更远处', {
        font,
        size: 4,
        height: 4,
        curveSegments: 0.2,
        bevelThickness: 0.1,
        bevelSize: 0.1,
        bevelEnabled: true

    });
    const materials = [
        new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true }), // front
        new THREE.MeshPhongMaterial({ color: 0xffffff }) // side
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
const animationFrameTrans = (mash, prop, valRegion = [0, 1], paragraph = 10, onComplete) => {
    const diff = valRegion[1] - valRegion[0];
    const count = diff / paragraph;
    mash[prop] = valRegion[0];

    const tick = () => {
        mash[prop] += count;
        if (mash[prop] <= valRegion[1]) {
            requestAnimationFrame(tick);
        } else onComplete && onComplete();
    }
    tick();
}

function createSuccessInfo() {
    const textGeo = new TextGeometry('过关', {
        font,
        size: 15,
        height: 4,
        curveSegments: 0.5,
        bevelThickness: 0.5,
        bevelSize: 0.5,
        bevelEnabled: true

    });
    const materials = [
        new THREE.MeshPhongMaterial({ color: 0xa030ff, flatShading: true }), // front
        new THREE.MeshPhongMaterial({ color: 0x5511ff }) // side
    ];
    materials.forEach(m => {
        m.transparent = true;
        m.opacity = 0;
    })
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


    const blocker = document.getElementById("blocker");
    const instructions = document.getElementById("instructions");

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
            const passLevel = document.querySelector('#passLevel');
            passLevel.style['top'] = 0;
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

    const onKeyDown = function (event) {
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

            case "Space":
                //可以跳的时候跳 y轴增加 开始跳跃时将可以跳跃状态设置为false 不可以二连跳
                if (canJump === true) velocity.y += JumpHeight;
                canJump = false;
                break;
        }
    };

    const onKeyUp = function (event) {
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

    // floor
    let floorGeometry = new THREE.PlaneGeometry(2000, 2000, 2, 2);
    floorGeometry.rotateX(-Math.PI / 2);

    const floorMaterial = new THREE.MeshBasicMaterial({ color: 0xcfffcc });

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    scene.add(floor);

    const creatBox = (width, height) => {
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
            transparent: true,
            opacity: 0.3
        });
        boxMaterial.color.setHSL(
            Math.random() * 0.75 + 0.25,
            Math.random() * 0.95,
            Math.random() * 0.75 + 0.25
        );

        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        return box;
    }

    /**
    * 最后一块砖上显示成功文字
    */
    successText = createSuccessInfo();
    successText.position.x = 420;
    successText.position.y = 615;
    successText.position.z = 300;
    successText.rotation.y = Math.PI / -2;
    successText.userData.index = '过关';
    objects.push(successText);
    scene.add(successText);
    /**
    * 通天塔阶台阶🧱
    */
    const genBlock = () => {
        const half = blockCounts / 2;
        const height = 10;
        const width = 50;
        let startPoint;
        for (let i = 0; i <= blockCounts; i++) {
            const top = 10 * (i <= half ? half - i : i);
            const box = creatBox(width, height);
            const x = width * (i > half ? i - blockCounts : i) + i * 30 - 800;
            box.position.x = x;
            box.position.y = top / 2;
            box.position.z = i * 8;
            box.translateY(top);
            box.userData.index = i;
            blocks.push(box);
            if (i === half) startPoint = [x, top / 2, i * 8];
        }
        camera.position.set(...startPoint);
        /**
        * 第一阶段最终砖块 显示提示文字
        */
        //文字也可以踩
        const title = createTitle();
        title.position.set(-820, 350, 50);
        title.rotation.y = Math.PI / 2;
        title.userData.index = '踩提示文字上了';
        objects.push(title);
        scene.add(title);
    }
    genBlock();
    scene.add(...blocks);
    objects.push(...blocks);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    //!不加颜色变暗
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.body.appendChild(renderer.domElement);

    window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}
//先渲染一次 有个基础画面
renderer.render(scene, camera);

/**
* 传入角度即方向 判断附近有没有障碍物 返回障碍物数量
*/
const collideCheck = (angle) => {
    let rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeRotationY(angle * Math.PI / 180);
    const cameraDirection = controls.getDirection(new THREE.Vector3(0, 0, 0)).clone()
    cameraDirection.applyMatrix4(rotationMatrix);
    const raycaster = new THREE.Raycaster(controls.getObject().position.clone(), cameraDirection, 0, 5);
    raycaster.ray.origin.y -= eyeHeight;
    const intersections = raycaster.intersectObjects(objects, false);
    intersections.length && console.log(intersections[0].object.userData.index);
    return intersections.length;
}

const direction = new THREE.Vector3();

function animate() {
    animationFrame = requestAnimationFrame(animate);

    const time = performance.now();
    if (controls.isLocked === true) {
        /**
         * 射线原点是相机位置  但是 要从脚下开始算 所以 y轴 -10
         * 判断前面有没有
         */
        raycaster.ray.origin.copy(controls.getObject().position);
        raycaster.ray.origin.y -= eyeHeight;

        const intersections = raycaster.intersectObjects(objects, false);
        const onObject = intersections.length;

        //四个方位是否产生碰撞
        let leftCollide = false;
        let rightCollide = false;
        let forwardCollide = false;
        let backCollide = false;
        /**
        * 碰撞检测 collide check
        */
        if (moveForward) forwardCollide = collideCheck(0);
        if (moveBackward) backCollide = collideCheck(180);
        if (moveLeft) leftCollide = collideCheck(90);
        if (moveRight) rightCollide = collideCheck(270);
        // if (moveRight) rightCollide = collideCheck(360);

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // 确保各个方向的一致运动

        //每一帧的间隔时间 保证相同时间移动相同距离
        const delta = (time - prevTime) / 1000;

        //移动方向
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 5.8 * 100.0 * delta;
        //根据boolean值 巧妙判断方向 决定下面移动的值
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // 确保各个方向的一致运动

        //按下了前/后
        if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
        //按下了左/右
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

        //控制‘落地’
        if (onObject) {
            velocity.y = Math.max(0, velocity.y);
            canJump = true;
            console.log(intersections[0].object.userData.index);

            //踩到的砖块变实

            if (!intersections[0].object.userData.opacity) {
                intersections[0].object.userData.opacity = true;
                animationFrameTrans(intersections[0].object.material, 'opacity', [0.3, 1], 10);
            }

            //显示过关文字
            if (intersections[0].object.userData.index === blockCounts) {
                !alreadyPass && successText && successText.material.forEach(m => {
                    animationFrameTrans(m, 'opacity', [0, 1], 50);
                })
                setTimeout(() => {
                    controls.unlock();
                }, 1300)
                alreadyPass = true;
            }
        }

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
        //设置最终移动值 
        if (moveLeft || moveRight) controls.moveRight(rightDistance);

        if (moveForward || moveBackward) controls.moveForward(forwardDistance);
        //没暴露y轴设置方法 可通过下面方式实现
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

document.querySelector('#restart').addEventListener('click', () => {
    window.location.reload();
})

document.querySelector('#next').addEventListener('click', () => {
    alert('开发中。。。')
})