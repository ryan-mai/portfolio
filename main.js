import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';

import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

let container, stats;
let camera, controls, scene, renderer;
let width, height;
const cube = new THREE.Mesh( new THREE.BoxGeometry(), new THREE.MeshBasicMaterial( { color: 0x705138 } ) );
const worldWidth = 128, worldDepth = 128;
const worldHalfWidth = worldWidth / 2;
const worldHalfDepth = worldDepth / 2;
const data = generateHeight( worldWidth, worldDepth );

const clock = new THREE.Clock();

init();

function init() {
    container = document.getElementById( 'container' );

    width = window.innerWidth;
    height = window.innerHeight;

    camera = new THREE.PerspectiveCamera( 60, width / height, 1, 2000);
    camera.position.set( 0, 0, 10 );

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0xbfd1e5 );


    cube.position.set( 0, 1, 0 );
    scene.add(cube);

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
    pyGeom.attributes.uv.array[ 1 ] = 0.5;
    pyGeom.attributes.uv.array[ 3 ] = 0.5;
    pyGeom.rotateY( Math.PI / 2 );
    pyGeom.translate( 0, 50, 0 );

    const pzGeom = new THREE.PlaneGeometry( 100, 100 );
    pzGeom.attributes.uv.array[ 1 ] = 0.5;
    pzGeom.attributes.uv.array[ 3 ] = 0.5;
    pzGeom.rotateY( Math.PI / 2 );
    pzGeom.translate( 0, 0, 50 );

    const nzGeom = new THREE.PlaneGeometry( 100, 100 );
    nzGeom.attributes.uv.array[ 1 ] = 0.5;
    nzGeom.attributes.uv.array[ 3 ] = 0.5;
    nzGeom.rotateY( -Math.PI / 2 );
    nzGeom.translate( 0, 0, -50 );
    // pxGeometry.attributes.uv

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

    const texture = new THREE.TextureLoader().load( 'textures/atlas.png' );
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

    controls = new FirstPersonControls( camera, renderer.domElement );
    controls.movementSpeed = 200;
    controls.lookSpeed = 0.125;
    controls.lookVertical = true;

}

function onWindowResize() {
        width = window.innerWidth;
        height = window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize( width, height );
        renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2) );
        controls.handleResize();
}

function generateHeight( width, height ) {
    const data = [], perlin = new ImprovedNoise(),
        size = width * height, z = Math.random() * 100;
    
        let quality = 2;

        for ( let i = 0; i < 4; i ++ ) {
            if ( i === 0 ) for ( let i = 0; i < size; i ++ ) data[ i ] = 0;
            for ( let j = 0; j < size; j ++ ) {
                const x = j % width, y = ( j / width ) | 0;
                data[ i ] += perlin.noise( x / quality, y / quality, z) * quality;
            }
            quality *= 4
        }
    return data;
}

function getY( x, z ) {
    return ( data[ x + z * worldWidth ] * 0.15 ) | 0;
}

function animate() {
    requestAnimationFrame( animate );
    renderer.render( scene, camera );
    stats.update();
}

function render() {
    controls.update( clock.getDelta() );
    renderer.render( scene, camera );
}
