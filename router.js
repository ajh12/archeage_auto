
const uiRouter = (typeof window.uiRouter === 'function') ? window.uiRouter : null;

window.addEventListener('popstate', (event) => {
    if (window.isWriting) {
        history.pushState({ page: 'write' }, null, '#' + (ROUTE_MAP['write'] || 'write'));
        
        let msg = editingPostId ? "수정사항이 저장되지 않으며,\n원래 내용으로 유지됩니다." : "작성 중인 내용이 삭제됩니다.\n이동하시겠습니까?";
        let btn = editingPostId ? "이동" : "삭제 후 이동";

        showConfirm(msg, () => {
            resetEditor();
            window.isWriting = false; 
            const targetPage = lastPage || 'home';
            window.router(targetPage); 
        }, "페이지 이동", btn);
        return;
    }

    const rawHash = window.location.hash;
    const currentHash = rawHash.startsWith('#') ? decodeURIComponent(rawHash.substring(1)) : '';
    const hashParts = currentHash.split('/');
    const pageCode = hashParts[0];
    const paramId = hashParts[1];
    
    const realPage = (typeof getPageFromCode === 'function') ? getPageFromCode(pageCode) : 'home';

    if (realPage === 'detail' && paramId) {
        readPost(paramId);
    } else if (event.state && event.state.page) {
        window.router(event.state.page, false);
    } else {
        window.router(realPage, false);
    }
});

window.router = function(page, pushHistory = true) {
    if(pushHistory) {
        const code = (typeof ROUTE_MAP !== 'undefined' && ROUTE_MAP[page]) ? ROUTE_MAP[page] : page;
        if (page !== 'detail') {
            history.pushState({ page }, null, page === 'home' ? ' ' : `#${code}`);
        }
    }
    
    if (uiRouter && typeof uiRouter === 'function') {
        let uiPage = page;
        if (page === 'test') uiPage = 'list'; 
        uiRouter(uiPage, isAdmin);
    }
    
    if (page !== 'write' && page !== 'detail') {
        lastPage = page;
    }
    
    window.isWriting = (page === 'write');
    
    if (page === 'admin' && typeof switchAdminTab === 'function' && typeof currentAdminTab !== 'undefined') {
        switchAdminTab(currentAdminTab);
    }
    
    if(['notice', 'free', 'list', 'error', 'test'].includes(page)) {
        const boardInput = document.getElementById('boardSearchInput');
        if(boardInput) boardInput.value = '';

        fetchPosts(page === 'list' ? 'error' : page, 1);
    }
};

window.confirmNavigation = (targetPage) => {
    if (targetPage === 'back') {
        history.back();
        return;
    }

    if (window.isWriting) {
        let content = "";
        if (currentEditorMode === 'html') {
            const el = document.getElementById('editorContentHtml');
            if(el) content = el.innerText.trim();
        } else {
            const el = document.getElementById('editorContentMarkdown');
            if(el) content = el.value.trim();
        }
        
        const titleInput = document.getElementById('inputTitle');
        const title = titleInput ? titleInput.value : "";
        
        if (title.length > 0 || content.length > 0) {
            let msg = "";
            let btnText = "";
            if(editingPostId) {
                msg = "수정사항이 저장되지 않으며,\n원래 내용으로 유지됩니다.";
                btnText = "이동";
            } else {
                msg = "작성 중인 내용이 삭제됩니다.\n이동하시겠습니까?";
                btnText = "삭제 후 이동";
            }

            showConfirm(msg, () => {
                resetEditor();
                window.router(targetPage);
            }, "페이지 이동", btnText);
            return;
        }
        resetEditor();
    } 
    else if (editingCommentId || (document.getElementById('cmtContent') && document.getElementById('cmtContent').value.trim().length > 0)) {
        let msg = editingCommentId ? "수정 중인 댓글이 초기화됩니다.\n이동하시겠습니까?" : "작성 중인 댓글이 삭제됩니다.\n이동하시겠습니까?";
        
        showConfirm(msg, () => {
            cancelCommentEdit();
            window.router(targetPage);
        }, "페이지 이동", "이동");
        return;
    }

    window.router(targetPage);
};
