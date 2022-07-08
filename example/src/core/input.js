import { Vector2 } from 'three';

class Input {
  constructor(target) {
    this.attachments = [];
    this.buttons = {
      primary: false,
      secondary: false,
      tertiary: false,
      interact: false,
      run: false,
    };
    this.buttonState = { ...this.buttons };
    this.gamepad = false;
    this.look = new Vector2();
    this.movement = new Vector2();
    this.mouse = new Vector2();
    this.keyboard = new Vector2();
    this.pointer = new Vector2();
    this.speed = 4;
    this.target = target;
    this.onGamepadDisconnected = this.onGamepadDisconnected.bind(this);
    this.onGamepadConnected = this.onGamepadConnected.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseWheel = this.onMouseWheel.bind(this);
    this.onPointerLock = this.onPointerLock.bind(this);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected, false);
    window.addEventListener('gamepadconnected', this.onGamepadConnected, false);
    window.addEventListener('keydown', this.onKeyDown, false);
    window.addEventListener('keyup', this.onKeyUp, false);
    target.addEventListener('mousedown', this.onMouseDown, false);
    window.addEventListener('mouseup', this.onMouseUp, false);
    window.addEventListener('mousemove', this.onMouseMove, false);
    window.addEventListener('wheel', this.onMouseWheel, { passive: false });
    document.addEventListener('pointerlockchange', this.onPointerLock, false);
  }

  dispose() {
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    window.removeEventListener('gamepadconnected', this.onGamepadConnected);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('wheel', this.onMouseWheel);
    document.removeEventListener('pointerlockchange', this.onPointerLock);
    document.body.classList.remove('pointerlock');
  }
    
  lock() {
    const { isLocked, target } = this;
    if (!isLocked) {
      target.requestPointerLock();
    }
  }

  unlock() {
    const { isLocked } = this;
    if (isLocked) {
      document.exitPointerLock();
    }
  }

  onAnimationTick() {
    const { buttons, buttonState, gamepad, keyboard, look, mouse, movement } = this;
    look.copy(mouse);
    mouse.set(0, 0);
    movement.copy(keyboard);
    let gamepadState = {};
    if (gamepad !== false) {
      const { axes, buttons } = navigator.getGamepads()[gamepad];
      if (Math.max(Math.abs(axes[0]), Math.abs(axes[1])) > 0.1) {
        movement.set(axes[0], -axes[1]);
      }
      if (Math.max(Math.abs(axes[2]), Math.abs(axes[3])) > 0.1) {
        look.set(-axes[2] * 0.03, axes[3] * 0.03);
      }
      gamepadState = {
        primary: buttons[7] && buttons[7].pressed,
        secondary: buttons[6] && buttons[6].pressed,
        tertiary: false,
        interact: buttons[0] && buttons[0].pressed,
        run: buttons[10] && buttons[10].pressed,
      };
    }
    ['primary', 'secondary', 'tertiary', 'interact', 'run'].forEach((button) => {
      const state = buttonState[button] || gamepadState[button];
      buttons[`${button}Down`] = state && buttons[button] !== state;
      buttons[`${button}Up`] = !state && buttons[button] !== state;
      buttons[button] = state;
    });
  }

  onGamepadDisconnected({ gamepad: { index } }) {
    const { gamepad } = this;
    if (gamepad === index) {
      this.gamepad = false;
    }
  }

  onGamepadConnected({ gamepad: { index } }) {
    this.gamepad = index;
  }

  onKeyDown({ key, repeat, target }) {
    const { buttonState, isLocked, keyboard } = this;
    if (!isLocked || repeat || target.tagName === 'INPUT') {
      return;
    }
    switch (key.toLowerCase()) {
      case 'w':
        keyboard.y = 1;
        break;
      case 's':
        keyboard.y = -1;
        break;
      case 'a':
        keyboard.x = -1;
        break;
      case 'd':
        keyboard.x = 1;
        break;
      case 'e':
        buttonState.interact = true;
        break;
      case 'shift':
        buttonState.run = true;
        break;
      default:
        break;
    }
  }

  onKeyUp({ key }) {
    const { buttonState, isLocked, keyboard } = this;
    if (!isLocked) {
      return;
    }
    switch (key.toLowerCase()) {
      case 'w':
        if (keyboard.y > 0) keyboard.y = 0;
        break;
      case 's':
        if (keyboard.y < 0) keyboard.y = 0;
        break;
      case 'a':
        if (keyboard.x < 0) keyboard.x = 0;
        break;
      case 'd':
        if (keyboard.x > 0) keyboard.x = 0;
        break;
      case 'e':
        buttonState.interact = false;
        break;
      case 'shift':
        buttonState.run = false;
        break;
      default:
        break;
    }
  }

  onMouseDown({ button }) {
    const { buttonState, isLocked } = this;
    if (!isLocked) {
      this.lock();
      return;
    }
    switch (button) {
      case 0:
        buttonState.primary = true;
        break;
      case 1:
        buttonState.tertiary = true;
        break;
      case 2:
        buttonState.secondary = true;
        break;
      default:
        break;
    }
  }

  onMouseUp({ button }) {
    const { buttonState, isLocked } = this;
    if (!isLocked) {
      return;
    }
    switch (button) {
      case 0:
        buttonState.primary = false;
        break;
      case 1:
        buttonState.tertiary = false;
        break;
      case 2:
        buttonState.secondary = false;
        break;
      default:
        break;
    }
  }

  onMouseMove({ clientX, clientY, movementX, movementY }) {
    const { isLocked, mouse, pointer } = this;
    if (!isLocked) {
      return;
    }
    mouse.x -= movementX * 0.003;
    mouse.y -= movementY * 0.003;
    pointer.set(
      (clientX / window.innerWidth) * 2 - 1,
	    -(clientY / window.innerHeight) * 2 + 1
    );
  }

  onMouseWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault();
    }
    const { minSpeed, speedRange } = Input;
    const { speed } = this;
    const logSpeed = Math.min(
      Math.max(
        ((Math.log(speed) - minSpeed) / speedRange) - (e.deltaY * 0.0003),
        0
      ),
      1
    );
    this.speed = Math.exp(minSpeed + logSpeed * speedRange);
  }

  onPointerLock() {
    const { buttonState, keyboard } = this;
    this.isLocked = !!document.pointerLockElement;
    document.body.classList[this.isLocked ? 'add' : 'remove']('pointerlock');
    if (!this.isLocked) {
      buttonState.primary = false;
      buttonState.secondary = false;
      buttonState.tertiary = false;
      buttonState.interact = false;
      buttonState.run = false;
      keyboard.set(0, 0);
    }
  }
}

Input.minSpeed = Math.log(1);
Input.maxSpeed = Math.log(10);
Input.speedRange = Input.maxSpeed - Input.minSpeed;

export default Input;
