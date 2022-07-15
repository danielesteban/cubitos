class Toolbar {
  constructor() {
    const dom = document.createElement('div');
    dom.id = 'toolbar';
    document.body.appendChild(dom);
    this.buttons = ['blast', 'light1', 'light2', 'light3'].map((id, index) => {
      const button = document.createElement('button');
      [`[${index + 1}]`, `${id}`].forEach((text) => {
        const span = document.createElement('span');
        span.innerText = text;
        button.appendChild(span);
      });
      button.addEventListener('click', () => this.setTool(index), false);
      dom.appendChild(button);
      return button;
    });
    this.setTool(0);
    this.onKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDown, false);
  }
  
  onKeyDown({ key, repeat, target }) {
    if (repeat || target.tagName === 'INPUT') {
      return;
    }
    switch (key.toLowerCase()) {
      case '1':
      case '2':
      case '3':
      case '4':
        this.setTool(parseInt(key, 10) - 1);
        break;
      default:
        break;
    }
  }

  setTool(tool) {
    const { buttons } = this;
    this.tool = tool;
    buttons.forEach((button, index) => {
      button.classList.remove('enabled');
      if (tool === index) {
        button.classList.add('enabled');
      }
    });
  }
}

export default Toolbar;
