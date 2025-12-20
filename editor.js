import { preprocessMarkdown, sanitizeContent } from './utils.js';
import { uploadImage } from './api.js';
import { showAlert } from './ui.js';

let lastSelectionRange = null;

export function switchEditorTab(tab) {
    const htmlBtn = document.getElementById('tab-html');
    const mdBtn = document.getElementById('tab-markdown');
    
    const htmlToolbar = document.getElementById('html-toolbar');
    const mdToolbar = document.getElementById('markdown-toolbar');
    
    const htmlArea = document.getElementById('editorContentHtml');
    const mdContainer = document.getElementById('markdown-container');
    const mdArea = document.getElementById('editorContentMarkdown');

    if (tab === 'html') {
        htmlBtn.className = "flex-1 py-3 text-sm font-bold text-blue-600 border-b-2 border-blue-600 bg-white";
        mdBtn.className = "flex-1 py-3 text-sm font-bold text-slate-500 hover:text-slate-700";
        
        htmlToolbar.classList.remove('hidden');
        mdToolbar.classList.add('hidden');
        
        htmlArea.classList.remove('hidden');
        mdContainer.classList.add('hidden');
        
        if (mdArea.value.trim().length > 0 && htmlArea.innerHTML.trim().length === 0) {
             htmlArea.innerHTML = marked.parse(mdArea.value);
        }
    } else {
        htmlBtn.className = "flex-1 py-3 text-sm font-bold text-slate-500 hover:text-slate-700";
        mdBtn.className = "flex-1 py-3 text-sm font-bold text-blue-600 border-b-2 border-blue-600 bg-white";
        
        htmlToolbar.classList.add('hidden');
        mdToolbar.classList.remove('hidden');
        
        htmlArea.classList.add('hidden');
        mdContainer.classList.remove('hidden');
        
        updateMarkdownPreview();
    }
    return tab;
}

export function updateMarkdownPreview() {
    const raw = document.getElementById('editorContentMarkdown').value;
    const processed = preprocessMarkdown(raw);
    const preview = document.getElementById('markdown-preview');
    preview.innerHTML = sanitizeContent(marked.parse(processed));
}

export function execCmd(command, value = null) {
    document.execCommand(command, false, value);
    document.getElementById('editorContentHtml').focus();
    updateToolbar(); 
}

export function updateToolbar() {
    const commands = [
        { cmd: 'bold', id: 'btn-bold' },
        { cmd: 'italic', id: 'btn-italic' },
        { cmd: 'underline', id: 'btn-underline' },
        { cmd: 'strikeThrough', id: 'btn-strikethrough' },
        { cmd: 'justifyLeft', id: 'btn-justifyLeft' },
        { cmd: 'justifyCenter', id: 'btn-justifyCenter' },
        { cmd: 'justifyRight', id: 'btn-justifyRight' }
    ];

    commands.forEach(item => {
        const btn = document.getElementById(item.id);
        if (btn) {
            if (document.queryCommandState(item.cmd)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
}

export function insertMarkdown(symbol) {
    const textarea = document.getElementById('editorContentMarkdown');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const selection = text.substring(start, end);

    let newText = "";
    if (symbol === '`' && selection.includes('\n')) {
        newText = before + "```\n" + selection + "\n```" + after;
    } else {
        newText = before + symbol + selection + symbol + after;
    }
    
    textarea.value = newText;
    textarea.focus();
    updateMarkdownPreview();
}

export function saveSelection() {
    const editor = document.getElementById('editorContentHtml');
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
        lastSelectionRange = sel.getRangeAt(0);
    }
}

export async function processPostImage(file, currentEditorMode) {
    if (!file.type.match('image.*')) {
        showAlert("이미지 파일(JPG, PNG, GIF 등)만 업로드 가능합니다.");
        return;
    }

    const loader = document.getElementById('global-loader');
    if(loader) loader.classList.remove('hidden');
    
    const insertToEditor = (url) => {
            if (currentEditorMode === 'html') {
                const editor = document.getElementById('editorContentHtml');
                editor.focus();
                if (lastSelectionRange) {
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(lastSelectionRange);
                }
                document.execCommand('insertHTML', false, `<img src="${url}"><p><br></p>`);
            } else {
                const textarea = document.getElementById('editorContentMarkdown');
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const text = textarea.value;
                const newText = text.substring(0, start) + `\n![이미지](${url})\n` + text.substring(end);
                textarea.value = newText;
                textarea.focus();
                updateMarkdownPreview();
            }
    };

    try {
        const publicUrl = await uploadImage(file);
        if (publicUrl) {
            insertToEditor(publicUrl);
        } else {
            const reader = new FileReader();
            reader.onload = function(e) { insertToEditor(e.target.result); };
            reader.readAsDataURL(file);
        }
    } catch(e) {
        const reader = new FileReader();
        reader.onload = function(e) { insertToEditor(e.target.result); };
        reader.readAsDataURL(file);
    } finally {
        if(loader) loader.classList.add('hidden');
    }
}

export async function processCommentImages(files, currentCommentImages, renderCallback) {
    if(!files || files.length === 0) return;

    const loader = document.getElementById('global-loader');
    if(loader) loader.classList.remove('hidden');

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            if (!file.type.match('image.*')) {
                showAlert("이미지 파일(JPG, PNG, GIF 등)만 업로드 가능합니다.");
                continue; 
            }

            try {
                const publicUrl = await uploadImage(file);
                if(publicUrl) {
                    currentCommentImages.push(publicUrl);
                } else { throw new Error('No DB client'); }
            } catch(err) { 
                await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        currentCommentImages.push(e.target.result);
                        resolve();
                    };
                    reader.readAsDataURL(file);
                });
            }
        }
    } finally {
        if (renderCallback) renderCallback();
        if(loader) loader.classList.add('hidden');
    }
}

export function setupPasteHandlers(postImageCallback, commentImageCallback) {
    const handlePaste = (e, callback) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        const files = [];
        let hasImage = false;

        for (const item of items) {
            if (item.type.indexOf('image') === 0) {
                files.push(item.getAsFile());
                hasImage = true;
            }
        }

        if (hasImage) {
            e.preventDefault(); 
            callback(files);
        }
    };

    const htmlEditor = document.getElementById('editorContentHtml');
    if(htmlEditor) {
        htmlEditor.addEventListener('paste', (e) => {
            handlePaste(e, (files) => {
                if(files.length > 0 && postImageCallback) postImageCallback(files[0]); 
            });
        });
    }

    const mdEditor = document.getElementById('editorContentMarkdown');
    if(mdEditor) {
        mdEditor.addEventListener('paste', (e) => {
             handlePaste(e, (files) => {
                if(files.length > 0 && postImageCallback) postImageCallback(files[0]);
            });
        });
    }

    const cmtInput = document.getElementById('cmtContent');
    if(cmtInput) {
        cmtInput.addEventListener('paste', (e) => {
             handlePaste(e, (files) => {
                if (commentImageCallback) commentImageCallback(files); 
            });
        });
    }
}
