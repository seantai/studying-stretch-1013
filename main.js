// https://discourse.threejs.org/t/help-porting-shadertoy-to-threejs/2441/9

import * as THREE from 'three';
import BUFFER_A_FRAG from './glsl/BUFFER_A_FRAG.glsl'
import BUFFER_B_FRAG from './glsl/BUFFER_B_FRAG.glsl'

const VERTEX_SHADER = `
    varying vec2 vUv;
    
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
`;

const BUFFER_FINAL_FRAG = `
    uniform sampler2D iChannel0;
    uniform sampler2D iChannel1;
    varying vec2 vUv;
    
    void main() {
        vec2 uv = vUv;
        vec2 a = texture2D(iChannel1,uv).xy;

        gl_FragColor = vec4(texture2D(iChannel0,a).rgb,1.0);
        // gl_FragColor = vec4(gl_FragCoord.y, gl_FragCoord.y,0.,1.);
    }
`;

class App {
    constructor() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.renderer = new THREE.WebGLRenderer();
        this.loader = new THREE.TextureLoader();
        this.mousePosition = new THREE.Vector4();
        this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.counter = 0;
        this.targetA = new BufferManager(this.renderer, { width: this.width, height: this.height });
        this.targetB = new BufferManager(this.renderer, { width: this.width, height: this.height });
        this.targetC = new BufferManager(this.renderer, { width: this.width, height: this.height });
        this.renderer.setSize(this.width, this.height);
        document.body.appendChild(this.renderer.domElement);
        this.renderer.domElement.addEventListener('pointerdown', () => {
            this.mousePosition.setZ(1);
            // this.counter = 0;
        });
        this.renderer.domElement.addEventListener('pointerup', () => {
            this.mousePosition.setZ(0);
        });
        this.renderer.domElement.addEventListener('pointermove', event => {
            this.mousePosition.setX(event.clientX);
            this.mousePosition.setY(this.height - event.clientY);
        });
    }
    start() {
        const resolution = new THREE.Vector3(this.width, this.height, window.devicePixelRatio);
        const channel0 = this.loader.load('19bg.png');
        // const channel0 = this.loader.load('kew.webp');
        // this.loader.setCrossOrigin('');
        this.bufferA = new BufferShader(BUFFER_A_FRAG, {
            iFrame: { value: 0 },
            iResolution: { value: resolution },
            iMouse: { value: this.mousePosition },
            iChannel0: { value: null },
            iChannel1: { value: null }
        });
        this.bufferB = new BufferShader(BUFFER_B_FRAG, {
            iFrame: { value: 0 },
            iResolution: { value: resolution },
            iMouse: { value: this.mousePosition },
            iChannel0: { value: null }
        });
        this.bufferImage = new BufferShader(BUFFER_FINAL_FRAG, {
            iResolution: { value: resolution },
            iMouse: { value: this.mousePosition },
            iChannel0: { value: channel0 },
            iChannel1: { value: null }
        });
        this.animate();
    }

    // buffer[A-B] (BufferShader) are just ?temporary scenes with temporary meshes
    // target[A-C] (BufferManager) are just classes that hold
        // WebGLRenderTarget textures (readBuffer/writeBuffer)
        // a render()
    animate() {
        requestAnimationFrame(() => {
            this.bufferA.uniforms['iFrame'].value = this.counter++;
            // bufferA is the shader(inside mesh inside scene),
            // targetA is the webGLrenderTarget texture
            // sets i0 uniform to the rendertargetA, first empty, 2nd pass+ then
            //
            this.bufferA.uniforms['iChannel0'].value = this.targetA.readBuffer.texture;
            // sets i1 shader uniform to targetB rendertarget, 
            //which is mouse position stuff I believe
            this.bufferA.uniforms['iChannel1'].value = this.targetB.readBuffer.texture;
            // renders bufferA scene to own writerBuffer
            this.targetA.render(this.bufferA.scene, this.orthoCamera);
            // sets texture in ?B Scene shader, 
            this.bufferB.uniforms['iChannel0'].value = this.targetB.readBuffer.texture;
            // renders bufferB writeBuffer , and swaps
            // so we're writing the B scene to it's own rendertarget/writebuffer
            this.targetB.render(this.bufferB.scene, this.orthoCamera);
            // sets ?mouse texture in final shader + (mixes this with image)
            // ? so are we simply setting new "uvs" here
            // sets the swapped target A texture
            this.bufferImage.uniforms['iChannel1'].value = this.targetA.readBuffer.texture;
            // renders final scene, and swaps
            this.targetC.render(this.bufferImage.scene, this.orthoCamera, true);
            //loop
            this.animate();
        });
    }
}
// buffer A,B,Image
class BufferShader {
    constructor(fragmentShader, uniforms = {}) {
        this.uniforms = uniforms;
        this.material = new THREE.ShaderMaterial({
            fragmentShader,
            vertexShader: VERTEX_SHADER,
            uniforms
        });
        this.scene = new THREE.Scene();
        this.scene.add(new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), this.material));
    }
}
// target A,B,C
class BufferManager {
    constructor(renderer, { width, height }) {
        this.renderer = renderer;
        this.readBuffer = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            stencilBuffer: false
        });
        this.writeBuffer = this.readBuffer.clone();
    }
    swap() {
        const temp = this.readBuffer;
        this.readBuffer = this.writeBuffer;
        this.writeBuffer = temp;
    }
    render(scene, camera, toScreen = false) {
        if (toScreen) {
            // this one is used by the final ?thing
            this.renderer.render(scene, camera);
        }
        else {
            //can't do this.readBuffer b/c it creates loop "between Framebuffer and active Texture"
            //right, b/c in this old version, you choose alternatively to render to webGLrenderetxture instead of scene
            // this one is used by target A and B, because we aren't painting the scene. 
            this.renderer.render(scene, camera, this.writeBuffer, true);
        }
        this.swap();
    }
}
document.addEventListener('DOMContentLoaded', () => {
    (new App()).start();
});