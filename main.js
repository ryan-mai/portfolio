import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { RapierPhysics } from 'three/addons/physics/RapierPhysics.js';
import { RapierHelper } from 'three/addons/helpers/RapierHelper.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

let container, stats;
let camera, controls, scene, renderer;
let width, height;
const worldWidth = 128, worldDepth = 128;
const worldHalfWidth = worldWidth / 2;
const worldHalfDepth = worldDepth / 2;
const data = generateHeight( worldWidth, worldDepth );

let skeleton, model, loader, dracoLoader;

let physics, characterController, physicsHelper;
let player, movement;

const clock = new THREE.Clock();
const fps = 60;
const interval =  1 / fps;
let accumulator = 0;

let group, textMesh1, textMesh2, textGeo, textMat;
let font = null, text = null;
const depth = 0.1,
    hover = 30,
    curveSegments = 4,
    bevelThickness = 2,
    bevelSize = 1.5;

init();

async function init() {
    container = document.getElementById( 'container' );

    width = window.innerWidth;
    height = window.innerHeight;

    camera = new THREE.PerspectiveCamera( 60, width / height, 1, 20000);
    camera.position.y = getY( worldHalfWidth, worldHalfDepth ) * 100 + 100;

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0xbfd1e5 );

    stats = new Stats();
    document.body.appendChild(stats.dom);

    const matrix = new THREE.Matrix4();

    const pxGeom = new THREE.PlaneGeometry( 100, 100 );
    pxGeom.attributes.uv.array[ 1 ] = 0.5;
    pxGeom.attributes.uv.array[ 3 ] = 0.5;
    pxGeom.rotateY( Math.PI / 2 );
    pxGeom.translate( 50, 0, 0 );

    const nxGeom = new THREE.PlaneGeometry( 100, 100 );
    nxGeom.attributes.uv.array[ 1 ] = 0.5;
    nxGeom.attributes.uv.array[ 3 ] = 0.5;
    nxGeom.rotateY( -Math.PI / 2 );
    nxGeom.translate( -50, 0, 0 );

    const pyGeom = new THREE.PlaneGeometry( 100, 100 );
    pyGeom.attributes.uv.array[ 5 ] = 0.5;
    pyGeom.attributes.uv.array[ 7 ] = 0.5;
    pyGeom.rotateX( -Math.PI / 2 );
    pyGeom.translate( 0, 50, 0 );

    const pzGeom = new THREE.PlaneGeometry( 100, 100 );
    pzGeom.attributes.uv.array[ 1 ] = 0.5;
    pzGeom.attributes.uv.array[ 3 ] = 0.5;
    pzGeom.rotateY( 0 );
    pzGeom.translate( 0, 0, 50 );

    const nzGeom = new THREE.PlaneGeometry( 100, 100 );
    nzGeom.attributes.uv.array[ 1 ] = 0.5;
    nzGeom.attributes.uv.array[ 3 ] = 0.5;
    nzGeom.rotateY( Math.PI );
    nzGeom.translate( 0, 0, -50 );

    const geomtries = [];

    for ( let z = 0; z < worldDepth; z ++ ) {
        for ( let x = 0; x < worldWidth; x ++ ) {
            const h = getY( x, z );
            matrix.makeTranslation(
              x * 100 - worldHalfWidth * 100,
              h * 100,
              z * 100 - worldHalfDepth * 100,
            );
            const px = getY( x + 1, z );
            const nx = getY ( x - 1, z );
            const pz = getY( x, z + 1 );
            const nz = getY( x, z - 1 );

            geomtries.push( pyGeom.clone().applyMatrix4( matrix ) );

            if ( ( px !== h && px !== h + 1 ) || x === 0 ) {
                geomtries.push( pxGeom.clone().applyMatrix4( matrix ) );
            }

            if ( ( nx !== h && nx !== h + 1 ) || x === worldWidth - 1 ) {
                geomtries.push( nxGeom.clone().applyMatrix4( matrix ) );
            }

            if ( ( pz !== h && pz !== h + 1 ) || z === worldDepth - 1 ) {
                geomtries.push( pzGeom.clone().applyMatrix4( matrix ) );
            }

            if ( ( nz !== h && nz !== h + 1 ) || z === 0 ) {
                geomtries.push( nzGeom.clone().applyMatrix4( matrix ) );
            }
        }
    }

    const geometry = BufferGeometryUtils.mergeGeometries( geomtries );
    geometry.computeBoundingSphere();


    const texture = new THREE.TextureLoader().load( 'textures/grass.png' );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;

    const mesh = new THREE.Mesh( geometry, new THREE.MeshLambertMaterial( { map: texture, side: THREE.DoubleSide } ) );
    scene.add( mesh );

    const ambientLight = new THREE.AmbientLight( 0xeeeeee, 3 );
    scene.add( ambientLight );

    const directionalLight = new THREE.DirectionalLight( 0xffffff, 12 );
    scene.add( directionalLight );

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio || 2 );
    renderer.setSize( width, height );
    renderer.setAnimationLoop( animate );
    container.append( renderer.domElement );

    controls = new OrbitControls( camera, renderer.domElement );
    controls.target = new THREE.Vector3( 0, 2, 0);
    controls.update();

    initPhysics();

    movement = { forward: 0, right: 0 };
    window.addEventListener( 'keydown', onKeyDown );
    window.addEventListener( 'keyup', onKeyUp );
    window.addEventListener( 'resize', onWindowResize );

}

async function initPhysics() {
    physics = await RapierPhysics();
    physicsHelper = new RapierHelper( physics.world );
    scene.add ( physicsHelper );
    physics.addScene( scene );
    addCharacterController();
}


function addCharacterController() {
    const playerHeight = 0.8
    const groundCenterY = getY ( worldHalfWidth, worldHalfDepth ) * 100;
    const topOffset = 200;
    const halfPlayerHeight = playerHeight / 2;
    const playerWorldY = groundCenterY + topOffset + halfPlayerHeight;

    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath( 'gltf/' );

    loader = new GLTFLoader();
    loader.setDRACOLoader( dracoLoader );
    loader.load('models/sign.glb', function( gltf ) {
        model = gltf.scene;
        model.position.set( 0, worldDepth - 75, worldWidth + 50 );
        model.scale.set( 250, 250, 250 );
        scene.add( model );

        model.traverse( function ( object ) {
            if ( object.isMesh ) object.castShadow = true;
        } );        
    })
    loader.load( 'models/steve.glb', function ( gltf ) {
        model = gltf.scene;
        model.position.set( 0, worldDepth + 100, 0 );
        model.scale.set( 1, 1, 1 );
        model.rotateX( Math.PI / 2 )
        scene.add( model );

        model.traverse( function ( object ) {
            if ( object.isMesh ) object.castShadow = true;
        } );

        
        player = model;

        characterController = physics.world.createCharacterController( 0.01 );
        characterController.setApplyImpulsesToDynamicBodies( true );
        characterController.setCharacterMass( 30 );
        const colliderDesc = physics.RAPIER.ColliderDesc.capsule( 0.5, 0.3 ).setTranslation( 0, playerWorldY, 0 );
        player.userData.collider = physics.world.createCollider( colliderDesc );
    
        const textLoader = new TTFLoader();

        textLoader.load( './fonts/Minecraftia-Regular.ttf', function ( json ) {

        font = new Font( json );
        text = 'Hey, my name\nis Ryan!'
        createText(text, 10);

} );

    },
    undefined,
    function ( error ) {
        console.warn( error ); 
        const geometry = new THREE.CapsuleGeometry( 10, 30, 16, 32 );
        const material = new THREE.MeshStandardMaterial( { color: 0x0000ff } );
        player = new THREE.Mesh( geometry, material );
        player.castShadow = true;
        player.position.set( 0, 0, 0 );
        scene.add( player );
        characterController = physics.world.createCharacterController( 0.01 );
        characterController.setApplyImpulsesToDynamicBodies( true );
        characterController.setCharacterMass( 30 );
        const colliderDesc = physics.RAPIER.ColliderDesc.capsule( 0.5, 0.3 ).setTranslation( 0, playerWorldY, 0 );
        player.userData.collider = physics.world.createCollider( colliderDesc );
    } );
};
function createText(text, size,) {

    textGeo = new TextGeometry( text, {

        font: font,

        size: size,
        depth: depth,

    } );

    textGeo.computeBoundingBox();
    textGeo.computeVertexNormals();
    textGeo.translate(-textGeo.boundingBox.max.x / 2, 0, 0);
    textMesh1 = new THREE.Mesh( textGeo, textMat );

    textMesh1.position.x = 0;
    textMesh1.position.y = worldDepth + 30;
    textMesh1.position.z = worldDepth + 44;

    textMesh1.rotation.y = Math.PI;
    // textMesh1.rotation.y = Math.PI * 2;

    scene.add( textMesh1 );

}
// Helper Functions
function onKeyDown( event ) {
    if ( event.key == 'w' || event.key == 'ArrowUp' ) movement.forward = 1;
    else if ( event.key == 's' || event.key == 'ArrowDown' ) movement.forward = -1;
    else if ( event.key == 'd' || event.key == 'ArrowRight' ) movement.right = 1;
    else if ( event.key == 'a' || event.key == 'ArrowLeft' ) movement.right = -1;
}

function onKeyUp( event ) {
    if ([ 'w', 'ArrowUp', 's', 'ArrowDown' ].includes( event.key ) ) movement.forward = 0;
    else if ([ 'd', 'ArrowRight', 'a', 'ArrowLeft' ].includes( event.key ) ) movement.right = 0; 
}

function random( min, max ) {
    return Math.random() * ( max - min ) + min;
}

function onWindowResize() {
        width = window.innerWidth;
        height = window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize( width, height );
        renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2) );
        // controls.handleResize();
}

function generateHeight( width, height ) {
    const data = [], perlin = new ImprovedNoise(),
        size = width * height, z = 42;
    let quality = 2;
    for ( let i = 0; i < 4; i ++ ) {
        if ( i === 0 ) for ( let j = 0; j < size; j ++ ) data[ j ] = 0;
        for ( let j = 0; j < size; j ++ ) {
            const x = j % width, y = ( j / width ) | 0;
            data[ j ] += perlin.noise( x / quality, y / quality, z ) * quality;
        }
        quality *= 4;
    }
    return data;
}


function getY( x, z ) {
    return ( data[ x + z * worldWidth ] * 0.15 ) | 0;
}


function animate() {   
    if ( physicsHelper ) physicsHelper.update();
    if ( physics && characterController ) {
        const deltaTime = 1 / 60;
        const speed = 1000 * deltaTime;
        const moveVector = new physics.RAPIER.Vector3( movement.right * speed, 0, -movement.forward * speed )

        characterController.computeColliderMovement( player.userData.collider, moveVector );

        const translation = characterController.computedMovement();
        const position = player.userData.collider.translation();

        position.x += translation.x;
        position.y += translation.y;
        position.z += translation.z;

        player.userData.collider.setTranslation( position );
        player.position.set( position.x, position.y, position.z );

    }

    renderer.render(scene, camera);
    stats.update();
}