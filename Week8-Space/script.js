import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';


const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// add invisible plane to receive raycaster clicks
const plane = new THREE.Mesh(
new THREE.PlaneGeometry(window.innerWidth, window.innerHeight),
new THREE.MeshBasicMaterial({ visible: false })
);

let skyTexture;
let skyMaterial;

let meshes = [];

init();


function init3DScene(){
    camera.position.set(0, 1, 5);
    light.position.set(5,5,5);
    scene.add(light);
    scene.add(plane);
}

function init(){
    init3DScene();
    const textureLoader = new THREE.TextureLoader();
    skyTexture = textureLoader.load('skyAndMountain.jpg');
    skyMaterial = new THREE.MeshBasicMaterial({ map: skyTexture,side: THREE.DoubleSide  });
    window.addEventListener('click', onMouseClick, false);
    renderer.setAnimationLoop( animate );
}

function instantiateTriangleMesh(positionArr,scaleArr){
    const triangleVertices = new Float32Array( [
    -1.0,  3.0,  0.0,
    1.0,  3.0,  0.0,
    0.0,  0.0,  0.0
    ] ); 
    const triangleUVs = new Float32Array([
    0.0, 1.0,   // vertex 1 UV
    1.0, 1.0,   // vertex 2 UV
    0.5, 0.0    // vertex 3 UV
    ]);
    const triangleGeometry = new THREE.BufferGeometry();
    triangleGeometry.setAttribute( 'position', new THREE.BufferAttribute( triangleVertices, 3 ) );
    triangleGeometry.setAttribute( 'uv', new THREE.BufferAttribute( triangleUVs, 2 ) );
    triangleGeometry.computeVertexNormals();
    const triangleMesh = new THREE.Mesh( triangleGeometry, skyMaterial );
    triangleMesh.scale.set(scaleArr[0], scaleArr[1], scaleArr[2]);
    triangleMesh.position.set(positionArr[0], positionArr[1], positionArr[2]);
    scene.add( triangleMesh );

    return triangleMesh;
}

function onMouseClick(event){
    console.log("Mouse clicked");
    // use raycaster to convert 2D mouse position to 3D world position
    // map to -1 to 1
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);
    if (intersects.length > 0) {
        console.log(intersects[0].point);
        let newMesh = instantiateTriangleMesh([intersects[0].point.x, intersects[0].point.y, 0],[1,1,1]);
        meshes.push(newMesh);
    }
}

function updateTriangleMeshes(){
    for(let i = 0; i < meshes.length; i++){
        let mesh = meshes[i];

        // random rotation
        mesh.rotation.y += Math.random()*0.01;
        let maxHeight = plane.position.y + plane.geometry.parameters.height/2;

        if(mesh.position.y > maxHeight){
            // remove the mesh
            scene.remove(mesh);
            meshes.splice(i, 1);
            i--; // adjust index after removal
        }else{
            if(Math.random() < 0.5){
                // stretch the top side
                mesh.scale.y += 0.01;
                mesh.position.y += 0.005; // move the mesh up a bit to keep the bottom vertex in place
            }else{
                // move the bottom vertex up
                mesh.position.y += 0.01;
            }
        }

    }
}

// set animation loop
function animate() {
    renderer.render( scene, camera );
    updateTriangleMeshes();
}
