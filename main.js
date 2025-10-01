import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
// ...removed Rapier imports...
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

const degToRad = THREE.MathUtils.degToRad;

let container, stats;
let camera, controls, scene, renderer;
let width, height;
const worldWidth = 128, worldDepth = 128;
const worldHalfWidth = worldWidth / 2;
const worldHalfDepth = worldDepth / 2;
const data = generateHeight( worldWidth, worldDepth );

let skeleton, model, loader, dracoLoader;

// ...removed Rapier-related variables...
let movement;
let cameraSpeed = 800;

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

let raycaster = new THREE.Raycaster();
let pointer = new THREE.Vector2();
let hoverTip = null;

const colorList = ['#000000', '#0000AA', '#00AA00', '#00AAAA', '#AA0000', '#AA00AA', '#FFAA00', '#AAAAAA', '#555555', '#5555FF', '#55FF55', '#55FFFF', '#FF5555', '#FF55FF', '#FFFF55', '#DDD605', '#E3D4D1', '#CECACA', '#443A3B', '#971607', '#B4684D', '#DEB12D', '#47A036', '#2CBAA8', '#21497B', '#9A5CC6']

init();

async function init() {
    container = document.getElementById( 'container' );

    width = window.innerWidth;
    height = window.innerHeight;

    camera = new THREE.PerspectiveCamera( 60, width / height, 1, 20000);
    camera.position.y = getY( worldHalfWidth, worldHalfDepth ) * 100 + 500;
    camera.position.set( 0, worldDepth + 200, -25 );
    // camera.rotation.set( degToRad( 150 ), degToRad( -2.0 ), degToRad( -100 ) );
    
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

    const hudContainer = document.createElement('div');
    hudContainer.style.cssText = 'position:fixed; right:12px; top:12px; z-index:9999; display:flex; flex-direction:column; gap:8px; align-items:flex-end; font-family: Arial, Helvetica, sans-serif;';
    const helpContainer = document.createElement('div');
    helpContainer.style.cssText = 'position:fixed; right:12px; top:12px; z-index:9999; display:flex; flex-direction:column; gap:8px; align-items:flex-end; font-family: Arial, Helvetica, sans-serif;';
    const helpIconContainer = document.createElement('div');
    helpIconContainer.style.cssText = 'position:fixed; right:12px; bottom:12px; z-index:9999; display:flex; flex-direction:column; gap:8px; align-items:flex-end; font-family: Arial, Helvetica, sans-serif;';

    const helpIcon = document.createElement('div');
    helpIcon.style.cssText = 'width:36px; height:36px; background:rgba(255, 255, 255, 1); border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;';
    helpIcon.title = 'Controls (hover)';

    // add Material Symbols stylesheet (only once) and use the "info" symbol as the icon
    if (!document.querySelector('link[href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=info"]')) {
        const msLink = document.createElement('link');
        msLink.rel = 'stylesheet';
        msLink.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=info";
        document.head.appendChild(msLink);
    }

    helpIcon.innerHTML = '<span class="material-symbols-outlined" style="font-variation-settings:\'FILL\' 0, \'wght\' 800; font-size:18px; color:#2854C5;">info</span>';

    helpIconContainer.appendChild(helpIcon);
    document.body.appendChild(helpIconContainer);

    // bottom-right: help panel (moved here)
    const helpPanelContainer = document.createElement('div');
    helpPanelContainer.style.cssText = 'position:fixed; right:12px; bottom:12px; z-index:9999; display:flex; flex-direction:column; gap:8px; align-items:flex-end; font-family: Arial, Helvetica, sans-serif;';

    const helpDiv = document.createElement('div');
    helpDiv.style.cssText = 'background: rgba(0,0,0,0.85); color: #fff; padding: 8px 10px; border-radius: 6px; font-size: 12px; max-width: 420px; line-height:1.4; display:none; text-align:right;';
    helpDiv.innerHTML = '<strong>Controls</strong><br/>WASD / Arrow keys: Move<br/>Mouse: Orbit & Zoom<br/>E / Q: Move up / down<br/>Click images to open links!<br/>Press <strong>H</strong> to toggle this help';

    helpPanelContainer.appendChild(helpDiv);
    document.body.appendChild(helpPanelContainer);

    // Hover behavior: hovering the icon shows the bottom-right panel; hovering the panel keeps it visible
    helpIcon.addEventListener('mouseenter', () => helpDiv.style.display = 'block');
    helpIcon.addEventListener('mouseleave', () => {
        setTimeout(() => { if (!helpDiv.matches(':hover') && !helpIcon.matches(':hover')) helpDiv.style.display = 'none'; }, 50);
    });
    helpDiv.addEventListener('mouseenter', () => helpDiv.style.display = 'block');
    helpDiv.addEventListener('mouseleave', () => {
        setTimeout(() => { if (!helpDiv.matches(':hover')) helpDiv.style.display = 'none'; }, 50);
    });

    // Bottom-left: persistent contact panel
    const contactContainer = document.createElement('div');
    contactContainer.style.cssText = 'position:fixed; left:12px; bottom:12px; z-index:9999; display:flex; flex-direction:column; gap:8px; align-items:flex-start; font-family: Arial, Helvetica, sans-serif;';

    const contactDiv = document.createElement('div');
    contactDiv.style.cssText = 'background: rgba(0,0,0,0.75); color: #fff; padding: 10px 12px; border-radius: 6px; font-size: 13px; max-width: 320px; line-height:1.4; text-align:left;';
    contactDiv.innerHTML = '<strong>Contact</strong><br/>Ryan Mai<br/><a href="mailto:ryanmai757@gmail.com" style="color:#9cf;" target="_blank" rel="noopener">Email</a> | <a href="https://github.com/ryan-mai" target="_blank" rel="noopener" style="color:#9cf;">Github</a>';
    contactContainer.appendChild(contactDiv);
    document.body.appendChild(contactContainer);

    // toggle help with "H"
    window.addEventListener('keydown', (ev) => {
        if ( ev.key && ev.key.toLowerCase() === 'h' ) {
            helpDiv.style.display = helpDiv.style.display === 'none' ? 'block' : 'none';
        }
    });

    renderer.domElement.addEventListener( 'pointermove', onPointerMove );
    renderer.domElement.addEventListener( 'pointerdown', onPointerDown );

    hoverTip = document.createElement( 'div' );
    hoverTip.style.cssText = [
        'position: fixed',
        'pointer-events: none',
        'background: rgba(0, 0, 0, 0.75)',
        'color: #fff',
        'padding: 6px 8px',
        'font-size: 13px',
        'z-index: 21474836478',
        'white-space: nowrap',
        'display: none',
    ].join(';');
    document.body.appendChild( hoverTip );

    controls = new OrbitControls( camera, renderer.domElement );
    controls.target = new THREE.Vector3( 0, 2, 0);
    controls.target.set(controls.target.x, camera.position.y, controls.target.z)
    controls.update();

    // ...removed initPhysics()...

    movement = { forward: 0, right: 0, up: 0 }; // added vertical axis
    window.addEventListener( 'keydown', onKeyDown );
    window.addEventListener( 'keyup', onKeyUp );
    window.addEventListener( 'resize', onWindowResize );

    // Scene content setup (models, images, text)
    setupScene();
}

function placeModel( model, { worldX = 0, worldZ = 0, rotY = 0, offsetAboveGround = 0 } = {} ) {
    model.updateMatrixWorld(true);
    scene.add( model );

    const bbox = new THREE.Box3().setFromObject( model );
    const minY = bbox.min.y;

    const ix = Math.floor( ( worldX + worldHalfWidth * 100 ) / 100 );
    const iz = Math.floor( ( worldZ + worldHalfDepth * 100 ) / 100 );
    const cx = Math.max( 0, Math.min( worldWidth - 1, ix ) );
    const cz = Math.max( 0, Math.min( worldDepth - 1, iz ) );
    const groundY = getY( cx, cz ) * 100;

    model.position.x = worldX;
    model.position.z = worldZ;
    model.rotation.y = rotY;
    model.position.y = groundY + offsetAboveGround - minY;

    model.traverse( o => { if ( o.isMesh ) o.castShadow = true; } );
}

function addImage( url, worldX = 0, worldY = null, worldZ = 0, width = 200, height = 200, rotY= 0, linkUrl = null ) {
    if ( worldY === null ) {
        const ix = Math.floor( ( worldX + worldHalfWidth * 100 ) / 100 );
        const iz = Math.floor( ( worldX + worldHalfDepth * 100 ) / 100 );
        const cx = Math.max( 0, Math.min( worldX + worldWidth * ix ) / 100 );
        const cz = Math.max( 0, Math.min( worldX + worldDepth * iz ) / 100 );
        worldY = getY( cx, cz ) * 100;
    }

    const texture = new THREE.TextureLoader().load( url );
    if ( texture && texture.colorSpace !== undefined ) texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshBasicMaterial( { map: texture, transparent: true, side: THREE.DoubleSide } );
    const geometry = new THREE.PlaneGeometry( width, height );
    const mesh = new THREE.Mesh( geometry, material );
    mesh.position.set( worldX, worldY, worldZ );
    mesh.rotation.y = rotY;

    if ( typeof linkUrl == 'string' && linkUrl.length > 0 ) {
        mesh.userData.link = linkUrl;
        mesh.userData.isClickable = true;
    }

    scene.add(mesh);

    return mesh;
}

function addModel( url, { worldX = 0, worldY = null, worldZ = 0, rotY = 0, scale = 1, offsetAboveGround = 0, castShadow = true } = {}, linkUrl = null ) {
    return new Promise( ( resolve, reject ) => {
        const loader = new GLTFLoader();

        if ( typeof dracoLoader !== 'undefined' && dracoLoader ) {
            loader.setDRACOLoader( dracoLoader );
        } else {
            const temp = new DRACOLoader();
            temp.setDecoderPath( 'gltf/' );
            loader.setDRACOLoader( temp );
        }

        loader.load( url, function ( gltf ) {
            const model = gltf.scene;
            model.scale.set( scale, scale, scale );

            if ( typeof worldY === 'number' ) {
                model.updateMatrixWorld(true);
                scene.add( model );
                const bbox = new THREE.Box3().setFromObject( model );
                const minY = bbox.min.y;
                model.position.set( worldX, worldY, worldZ );
                model.rotation.y = rotY;
                model.position.y = worldY + offsetAboveGround - minY;
            } else {
                placeModel( model, { worldX, worldZ , rotY, offsetAboveGround } );
            }

            if ( typeof linkUrl === 'string' && linkUrl.length > 0 ) {
                model.userData = model.userData || {};
                model.userData.link = linkUrl;
                model.userData.isClickable = true

                model.traverse  ( obj => {
                    if ( obj.isMesh ) {
                        obj.userData = obj.userData || {};
                        obj.userData.link = linkUrl;
                        obj.userData.isClickable = true;
                    }
                })
            }

            if ( castShadow ) model.traverse( obj => { if ( obj.isMesh ) obj.castShadow = true; } );
            resolve ( model );
        }, undefined, function ( err) { 
            console.log( err );
            reject( err );
        } );
    });
}

function onPointerMove( event ) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ( ( event.clientX - rect.left ) / rect.width ) * 2 - 1;
    pointer.y = - ( ( event.clientY - rect.top ) / rect.height ) * 2 + 1;

    raycaster.setFromCamera( pointer, camera);
    const intersects = raycaster.intersectObjects( scene.children, true );

    let overLink = false;
    let hoveredLink = null;
    for ( let i = 0; i < intersects.length; i++ ) {
        const obj = intersects[i].object;
        if ( obj.userData && obj.userData.isClickable ) {
            overLink = true;
            hoveredLink = obj.userData.link;
            break;
        }
    }
    renderer.domElement.style.cursor = overLink ? 'pointer' : 'default';
    if ( hoverTip ) {
        if ( overLink ) {
            hoverTip.style.display = 'block';
            hoverTip.textContent = hoveredLink || '';
            hoverTip.style.left = ( event.clientX + 12 ) + 'px';
            hoverTip.style.top = ( event.clientY + 12 ) + 'px';
        } else {
        hoverTip.style.display = 'none';
        }
    }
}

function onPointerDown( event ) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ( ( event.clientX - rect.left ) / rect.width ) * 2 - 1;
    pointer.y = - ( ( event.clientY - rect.top ) / rect.height ) * 2 + 1;

    raycaster.setFromCamera( pointer, camera);
    const intersects = raycaster.intersectObjects( scene.children, true );

    for ( let i = 0; i < intersects.length; i++ ) {
        const obj = intersects[i].object;
        if ( obj.userData &&  obj.userData.link ) {
            window.open( obj.userData.link, '_blank' );
            return;
        }
    }
}

function setupScene() {
    const playerHeight = 0.8
    const groundCenterY = getY ( worldHalfWidth, worldHalfDepth ) * 100;
    const topOffset = 200;
    const halfPlayerHeight = playerHeight / 2;
    const playerWorldY = groundCenterY + topOffset + halfPlayerHeight;

    addModel( 'models/frame.glb', { worldX: 135, worldZ: -500, rotY: degToRad(180), scale: 250, offsetAboveGround: 100 } )
        .catch( e => console.warn( 'frame load failed', e ) );

    addModel( 'models/sign.glb', { worldX: 0, worldY: -10, worldZ: 178, offsetAboveGround: 60, scale: 250 }, 'https://github.com/ryan-mai' )
        .catch( e => console.warn( 'sign1 load failed', e ) );
    addImage( 'images/me.jpeg', 10, 297, 234, 150, 150, degToRad(180) );

    addModel( 'models/frame.glb', { worldX: -115, worldZ: -570, rotY: degToRad(0), scale: 250, offsetAboveGround: 395 } )
        .catch( e => console.warn( 'frame load failed', e ) );

    addModel( 'models/sign.glb', { worldX: 0, worldY: 280, worldZ: -1300, offsetAboveGround: 60, scale: 250 }, 'https://github.com/ryan-mai/corporate-translator' )
        .catch( e => console.warn( 'sign1 load failed', e ) );
    addImage( 'images/corporatetranslator.png', 10, 590, -1300, 150, 150, degToRad(0), 'https://join.slack.com/t/seriousbusinessstuff/shared_invite/zt-39n69tneo-AEt7r4xs_g6i56BaLwXXYg' );

    addImage( 'images/esolang.png', 1000, 490, -1300, 250, 250, degToRad(-45), 'https://github.com/ryan-mai/6ix-esolang-fix' );

    addImage( 'images/hogrider.png', -1000, 490, -1300, 350, 350, degToRad(45), 'https://ryantheguy.itch.io/ian-the-type-of-guy' );

    addImage( 'images/thebiggestmenace.png', -1000, 490, 2300, 350, 350, degToRad(-225), 'https://github.com/ryan-mai/Big-Circles' );

    addImage( 'images/playerstat.png', 1000, 100, 2300, 500, 500, degToRad(200), );


    addModel( 'models/frame.glb', { worldX: 625, worldZ: -600, scale: 250, rotY: Math.PI, offsetAboveGround: 100 } )
        .catch( e => console.warn( 'frame load failed', e ) );      
    addModel( 'models/sign.glb', { worldX: 500, worldZ: 100, offsetAboveGround: 50, scale: 250 }, 'https://github.com/ryan-mai/flying-balls' )
        .catch( e => console.warn( 'sign2 load failed', e ) );
    addImage( 'images/flying_balls.png', 500, 297, 134, 150, 150, degToRad(180), 'https://flying-balls-ten.vercel.app' );

    addModel( 'models/frame.glb', { worldX: 350, worldZ: 750, scale: 250, rotY: Math.PI, offsetAboveGround: 20 } )
        .catch( e => console.warn( 'frame load failed', e ) );      
    addModel( 'models/sign.glb', { worldX: 225, worldZ: 1500, offsetAboveGround: 50, scale: 250 }, 'https://github.com/Hung-Chi970104/time-less' )
        .catch( e => console.warn( 'sign2 load failed', e ) );
    addImage( 'images/timeless.png', 225, -85, 1488, 150, 150, degToRad(180), 'https://hungchi970104.itch.io/timeless' );


    addModel( 'models/frame.glb', { worldX: 2145, worldY: -145, worldZ: 765, scale: 250, rotY: Math.PI, offsetAboveGround: 50 } )
        .catch( e => console.warn( 'frame load failed', e ) );      
    addModel( 'models/sign.glb', { worldX: 2025, worldZ: 1500, offsetAboveGround: 50, scale: 250 }, 'https://github.com/ryan-mai/railgun' )
        .catch( e => console.warn( 'sign2 load failed', e ) );
    addImage( 'images/railgun.png', 2020, 0, 1500, 150, 150, degToRad(180), 'https://railgun-ashy.vercel.app/' );


    addModel( 'models/frame.glb', { worldX: 2610, worldY: -245, worldZ: -10, scale: 550, rotY: Math.PI, offsetAboveGround: 50 } )
        .catch( e => console.warn( 'frame load failed', e ) );      
    addModel( 'models/sign.glb', { worldX: 2325, worldZ: 1600, offsetAboveGround: 50, scale: 250 }, 'https://github.com/ryan-mai/koko' )
        .catch( e => console.warn( 'sign2 load failed', e ) );
    addImage( 'images/koko.png', 2320, 0, 1600, 400, 150, degToRad(180), 'https://koko-navy.vercel.app/' );


   
    addModel( 'models/steve.glb', { worldX: -150, worldY: 0, worldZ: 0, offsetAboveGround: 50, rotY: Math.PI/4, scale: 1 } )
        .then( m => { 
            model = m;
            model.scale.set( 1, 1, 1 );
            model.rotateX( Math.PI / 2 )

            model.traverse( function ( object ) {
                if ( object.isMesh ) object.castShadow = true;
            } );
        })
        .catch( e => console.warn( 'failed to load steve', e) );
    
    const textLoader = new TTFLoader();


    textLoader.load( './fonts/Minecraftia-Regular.ttf', function ( json ) {
        font = new Font( json );
        createText('I\'m from\n Toronto, Canada', 8, 0, worldDepth + 30, worldDepth + 44, degToRad(180), colorList[Math.floor(Math.random() * colorList.length)]);
        createText('Corporate Translator\n(Slack Bot)', 6, 0, 445, -1294, degToRad(0), colorList[Math.floor(Math.random() * colorList.length)]);
        createText('Hey, I\'m Ryan Mai!', 750,  500, 1000, 7000, Math.PI, colorList[Math.floor(Math.random() * colorList.length)]);
        createText('WASD/Arrow/Mouse to Move & Zoom', 100,  50, 2500, 7000, Math.PI, colorList[Math.floor(Math.random() * colorList.length)]);

        createText('Flying Balls\n(Latest Project)', 7,  500, worldDepth + 30, 93, Math.PI, colorList[Math.floor(Math.random() * colorList.length)]);
        createText('Timeless\n(DayDream Toronto!)', 6,  225, -245, 1493, Math.PI, colorList[Math.floor(Math.random() * colorList.length)]);
        createText('Railgun\n(Aframe.js)', 10,  2025, -145, 1493, Math.PI, colorList[Math.floor(Math.random() * colorList.length)]);
        createText('Koko Vr\n(Aframe.js)', 10,  2330, -145, 1592, Math.PI, colorList[Math.floor(Math.random() * colorList.length)]);
    } );
};

function createText(text, size, posX, posY, posZ, rotY = 0, color = 0x000000) {

    const textMat = new THREE.MeshStandardMaterial( { color: color } );

    const textGroup = new THREE.Group();

    const lines = String(text).split('\n');
    const lineHeight = size * 2.0;

    for ( let i = 0; i < lines.length; i++ ) {
        const line = lines[i] || ' ';
        const geo = new TextGeometry( line, {
            font: font,
            size: size,
            depth: 0.1,
        } );

        geo.computeBoundingBox();
        geo.computeVertexNormals();
        geo.center();

        const mesh = new THREE.Mesh( geo, textMat );
        const totalHeight = ( lines.length - 1 ) * lineHeight;
        mesh.position.y = ( totalHeight / 2 ) - ( i * lineHeight );
        textGroup.add( mesh );
    }

    textGroup.position.set( posX, posY, posZ );
    textGroup.rotation.y = rotY;

    scene.add( textGroup );

 }
// Helper Functions
function onKeyDown( event ) {
    const key = String(event.key).toLowerCase();

    if ( key === 'w' || key === 'arrowup' ) movement.forward = 1;
    else if ( key === 's' || key === 'arrowdown' ) movement.forward = -1;

    if ( key === 'd' || key === 'arrowright' ) movement.right = 1;
    else if ( key === 'a' || key === 'arrowleft' ) movement.right = -1;

    if ( key === 'e' || key === '.' ) movement.up = 1;
    else if ( key === 'q' || key === ',' ) movement.up = -1;
}

function onKeyUp( event ) {
    const key = String(event.key).toLowerCase();

    if ( [ 'w', 'arrowup', 's', 'arrowdown' ].includes( key ) ) movement.forward = 0;
    if ( [ 'd', 'arrowright', 'a', 'arrowleft' ].includes( key ) ) movement.right = 0;

    if ( [ 'e', '.' ].includes( key ) ) movement.up = 0;
    if ( [ 'q', ',' ].includes( key ) ) movement.up = 0;
}

function onWindowResize() {
    width = window.innerWidth;
    height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize( width, height );
    renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2) );
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
    const delta = clock.getDelta();
    const speed = cameraSpeed * delta;

    if ( movement.forward !== 0 || movement.right !== 0 || movement.up !== 0 ) {
        const up = new THREE.Vector3(0, 1, 0);
        const forward = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).normalize();
        const right = new THREE.Vector3().crossVectors(forward, up).normalize();

        const move = new THREE.Vector3();
        if ( movement.forward !== 0 ) move.addScaledVector(forward, movement.forward * speed);
        if ( movement.right !== 0 ) move.addScaledVector(right, movement.right * speed);
        if ( movement.up !== 0 ) move.addScaledVector(up, movement.up * speed);

        camera.position.add(move);
        controls.target.add(move);
        controls.update();
    } else {
        controls.update();
    }

    renderer.render(scene, camera);
}