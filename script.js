const stage = new Konva.Stage({
  container: 'container',
  width: window.innerWidth,
  height: window.innerHeight,
});

const layer = new Konva.Layer();
stage.add(layer);

const tr = new Konva.Transformer({
  keepRatio: false,
  boundBoxFunc: (oldBox, newBox) => {
    if (newBox.width < 10 || newBox.height < 10) {
      return oldBox;
    }
    return newBox;
  },
});
layer.add(tr);

// --- UI Controls ---
const floatingControls = document.getElementById('floating-text-controls');
const fontSizeSelect = document.getElementById('font-size');
const fontColorInput = document.getElementById('font-color');

// --- Image Handling ---

function addImage(imageSrc) {
  const image = new Image();
  image.onload = () => {
    const konvaImage = new Konva.Image({
      x: 50,
      y: 50,
      image: image,
      draggable: true,
      name: 'object',
    });
    layer.add(konvaImage);
  };
  image.src = imageSrc;
}

window.addEventListener('paste', (e) => {
  const items = (e.clipboardData || window.clipboardData).items;
  for (let index in items) {
    const item = items[index];
    if (item.kind === 'file') {
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (event) => {
        addImage(event.target.result);
      };
      reader.readAsDataURL(blob);
    }
  }
});

document.getElementById('upload-button').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', function (e) {
  const files = e.target.files;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const reader = new FileReader();
    reader.onload = (event) => {
      addImage(event.target.result);
    };
    reader.readAsDataURL(file);
  }
});

// --- General Object Handling (Selection, Transform, Delete) ---

let currentSelection = null;

function updateFloatingControls() {
    if (currentSelection && currentSelection.className === 'Text') {
        const textNode = currentSelection;
        const pos = textNode.absolutePosition();
        const textHeight = textNode.getClientRect({ skipTransform: false }).height;
        const gap = 1; // px

        floatingControls.style.display = 'block';
        floatingControls.style.top = (pos.y + textHeight + gap) + 'px';
        floatingControls.style.left = pos.x + 'px';
    } else {
        floatingControls.style.display = 'none';
    }
}

stage.on('click tap', (e) => {
  if (e.target === stage) {
    tr.nodes([]);
    if (currentSelection) {
        currentSelection.shadowOpacity(0);
        currentSelection.off('dragmove transform', updateFloatingControls);
        currentSelection = null;
    }
    updateFloatingControls();
    return;
  }

  if (e.target.getParent().className === 'Transformer') {
    return;
  }

  if (e.target.hasName('object')) {
    if (currentSelection !== e.target) {
        if (currentSelection) {
            currentSelection.shadowOpacity(0);
            currentSelection.off('dragmove transform', updateFloatingControls);
        }
        currentSelection = e.target;
        currentSelection.shadowColor('black');
        currentSelection.shadowBlur(10);
        currentSelection.shadowOpacity(0.6);
        currentSelection.shadowOffsetX(5);
        currentSelection.shadowOffsetY(5);

        if (currentSelection.className === 'Text') {
            currentSelection.on('dragmove transform', updateFloatingControls);
        }

        tr.nodes([currentSelection]);
        if (currentSelection.className === 'Text') {
            tr.enabledAnchors(['middle-left', 'middle-right']);
            tr.boundBoxFunc((oldBox, newBox) => {
                newBox.height = oldBox.height;
                return newBox;
            });
            fontSizeSelect.value = currentSelection.fontSize();
            fontColorInput.value = currentSelection.fill();
        } else {
            tr.enabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
            tr.boundBoxFunc((oldBox, newBox) => newBox);
        }
    }
  }
  updateFloatingControls();
});

// --- Text Editing and Creation ---

function editTextNode(textNode, isNew = false) {
    textNode.hide();
    tr.hide();
    floatingControls.style.display = 'none';

    const textPosition = textNode.absolutePosition();
    const stageBox = stage.container().getBoundingClientRect();
    const areaPosition = {
        x: stageBox.left + textPosition.x,
        y: stageBox.top + textPosition.y,
    };

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    textarea.value = textNode.text();
    textarea.style.position = 'absolute';
    textarea.style.top = areaPosition.y + 'px';
    textarea.style.left = areaPosition.x + 'px';
    textarea.style.width = textNode.width() * textNode.scaleX() + 'px';
    textarea.style.fontSize = textNode.fontSize() * textNode.scaleY() + 'px';
    textarea.style.border = 'none';
    textarea.style.padding = '0px';
    textarea.style.margin = '0px';
    textarea.style.overflow = 'hidden';
    textarea.style.background = 'none';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.lineHeight = textNode.lineHeight();
    textarea.style.fontFamily = textNode.fontFamily();
    textarea.style.transformOrigin = 'left top';
    textarea.style.textAlign = textNode.align();
    textarea.style.color = textNode.fill();
    textarea.focus();

    if (isNew) {
        textarea.select();
    }

    function autoResize() {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    autoResize();
    textarea.addEventListener('input', autoResize);

    function removeTextarea() {
        textarea.parentNode.removeChild(textarea);
        window.removeEventListener('click', handleOutsideClick);
        textNode.show();
        tr.show();
        tr.forceUpdate();
        updateFloatingControls();
    }

    function saveText() {
        textNode.text(textarea.value);
        textNode.height(textNode.getClientRect().height);
        removeTextarea();
    }

    textarea.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            saveText();
        }
        if (e.key === 'Escape') {
            removeTextarea();
        }
    });
    
    function handleOutsideClick(e) {
        if (e.target !== textarea) {
            saveText();
        }
    }
    setTimeout(() => {
        window.addEventListener('click', handleOutsideClick);
    });
}

stage.on('dblclick dbltap', (e) => {
    if (e.target === stage) {
        const pos = stage.getPointerPosition();
        const textNode = new Konva.Text({
            text: 'New Text',
            x: pos.x,
            y: pos.y,
            fontSize: 20,
            fill: '#000000',
            draggable: true,
            width: 200,
            name: 'object',
        });
        layer.add(textNode);
        editTextNode(textNode, true);
    } else if (e.target.className === 'Text') {
        editTextNode(e.target, false);
    }
});

// --- Style Controls ---

fontSizeSelect.addEventListener('change', (e) => {
    if (currentSelection && currentSelection.className === 'Text') {
        currentSelection.fontSize(parseInt(e.target.value, 10));
        updateFloatingControls(); // Update position after size change
    }
});

fontColorInput.addEventListener('input', (e) => {
    if (currentSelection && currentSelection.className === 'Text') {
        currentSelection.fill(e.target.value);
    }
});

// --- Window and System Handlers ---

stage.on('wheel', (e) => {
  e.evt.preventDefault();
  const scaleBy = 1.1;
  const oldScale = stage.scaleX();
  const pointer = stage.getPointerPosition();
  const mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale,
  };
  const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
  stage.scale({ x: newScale, y: newScale });
  const newPos = {
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  };
  stage.position(newPos);
});

window.addEventListener('resize', () => {
  stage.width(window.innerWidth);
  stage.height(window.innerHeight);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (currentSelection) {
      currentSelection.off('dragmove transform', updateFloatingControls);
      currentSelection.destroy();
      tr.nodes([]);
      currentSelection = null;
      updateFloatingControls();
    }
  }
});
