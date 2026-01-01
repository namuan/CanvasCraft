const stage = new Konva.Stage({
  container: 'container',
  width: window.innerWidth,
  height: window.innerHeight,
});

const layer = new Konva.Layer();
stage.add(layer);

const uiLayer = new Konva.Layer();
stage.add(uiLayer);

const tr = new Konva.Transformer({
  keepRatio: false,
  boundBoxFunc: (oldBox, newBox) => {
    if (newBox.width < 10 || newBox.height < 10) {
      return oldBox;
    }
    return newBox;
  },
});
uiLayer.add(tr);

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

document.getElementById('reset-zoom-button').addEventListener('click', () => {
  stage.scale({ x: 1, y: 1 });
  stage.position({ x: 0, y: 0 });
  stage.batchDraw();
});

// --- General Object Handling (Selection, Transform, Delete) ---

// --- Selection Handling ---

const selectionRectangle = new Konva.Rect({
    fill: 'rgba(0,0,255,0.3)',
    visible: false,
    listening: false,
});
uiLayer.add(selectionRectangle);

let selection = [];
let x1, y1, x2, y2;

function updateFloatingControls() {
    if (selection.length === 1 && selection[0].className === 'Text') {
        const textNode = selection[0];
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

function updateSelection() {
    // Clear old selection effects
    stage.find('.object').forEach(node => {
        node.shadowOpacity(0);
        node.off('dragmove transform', updateFloatingControls);
    });

    // Apply selection effects
    selection.forEach(node => {
        node.shadowColor('black');
        node.shadowBlur(10);
        node.shadowOpacity(0.6);
        node.shadowOffsetX(5);
        node.shadowOffsetY(5);
    });

    tr.nodes(selection);

    if (selection.length === 1 && selection[0].className === 'Text') {
        const node = selection[0];
        node.on('dragmove transform', updateFloatingControls);
        
        // Update inputs
        fontSizeSelect.value = node.fontSize();
        fontColorInput.value = node.fill();
        
        // Update anchors for text
        tr.enabledAnchors(['middle-left', 'middle-right']);
        tr.boundBoxFunc((oldBox, newBox) => {
            newBox.height = oldBox.height;
            return newBox;
        });
    } else {
        // Default anchors
        tr.enabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
        tr.boundBoxFunc((oldBox, newBox) => newBox);
    }
    
    updateFloatingControls();
}

stage.on('click tap', (e) => {
    // if selection rectangle was visible (we were dragging), ignore click
    if (selectionRectangle.visible() && (selectionRectangle.width() >= 5 || selectionRectangle.height() >= 5)) {
        return;
    }

    // if click on empty area - remove all selections
    if (e.target === stage) {
        selection = [];
        updateSelection();
        return;
    }

    // do nothing if clicked NOT on our rectangles
    if (!e.target.hasName('object')) {
        return;
    }

    // do we pressed shift or ctrl?
    const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
    const isSelected = selection.includes(e.target);

    if (!metaPressed && !isSelected) {
        // if no key pressed and the node is not selected
        // select just one
        selection = [e.target];
    } else if (metaPressed && isSelected) {
        // if we pressed keys and node was selected
        // we need to remove it from selection:
        selection = selection.filter(node => node !== e.target);
    } else if (metaPressed && !isSelected) {
        // add the node into selection
        selection.push(e.target);
    }
    
    updateSelection();
});

stage.on('mousedown touchstart', (e) => {
    if (e.target !== stage) {
        return;
    }
    e.evt.preventDefault();
    
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    const pos = stage.getPointerPosition();
    const layerPos = transform.point(pos);
    
    x1 = layerPos.x;
    y1 = layerPos.y;
    x2 = x1;
    y2 = y1;

    selectionRectangle.width(0);
    selectionRectangle.height(0);
    selectionRectangle.visible(true);
});

stage.on('mousemove touchmove', (e) => {
    if (!selectionRectangle.visible()) {
        return;
    }
    e.evt.preventDefault();
    
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    const pos = stage.getPointerPosition();
    const layerPos = transform.point(pos);
    
    x2 = layerPos.x;
    y2 = layerPos.y;

    selectionRectangle.setAttrs({
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
    });
});

stage.on('mouseup touchend', (e) => {
    if (!selectionRectangle.visible()) {
        return;
    }
    e.evt.preventDefault();
    
    setTimeout(() => {
        selectionRectangle.visible(false);
    });

    if (selectionRectangle.width() < 5 && selectionRectangle.height() < 5) {
         return;
    }

    const shapes = stage.find('.object');
    const box = selectionRectangle.getClientRect();
    const selected = shapes.filter((shape) =>
        Konva.Util.haveIntersection(box, shape.getClientRect())
    );
    selection = selected;
    updateSelection();
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
    selection.forEach(node => {
        if (node.className === 'Text') {
            node.fontSize(parseInt(e.target.value, 10));
        }
    });
    updateFloatingControls(); // Update position after size change
});

fontColorInput.addEventListener('input', (e) => {
    selection.forEach(node => {
        if (node.className === 'Text') {
            node.fill(e.target.value);
        }
    });
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
    if (selection.length > 0) {
      selection.forEach(node => {
          node.destroy();
      });
      selection = [];
      tr.nodes([]);
      updateFloatingControls();
    }
  }
});
