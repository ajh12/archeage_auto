
const uiRouter = (typeof window.uiRouter === 'function') ? window.uiRouter : null;
const BOARD_ROUTE_PAGES = ['notice', 'free', 'list', 'error', 'test'];

const isBoardRoutePage = (page) => BOARD_ROUTE_PAGES.includes(page);
const boardTypeFromRoute = (page) => page === 'list' ? 'error' : page;
const routeFromBoardType = (type) => type === 'error' ? 'list' : type;
const normalizeBoardKeyword = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeBoardPage = (value, fallback = 1) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

if (!window.boardRouteStateByType || typeof window.boardRouteStateByType !== 'object') {
    window.boardRouteStateByType = {};
}

const getBoardRouteState = (boardType) => {
    const key = boardTypeFromRoute(boardType);
    const raw = window.boardRouteStateByType[key] || {};
    return {
        page: normalizeBoardPage(raw.page, 1),
        keyword: normalizeBoardKeyword(raw.keyword)
    };
};

const setBoardRouteState = (boardType, page, keyword) => {
    const key = boardTypeFromRoute(boardType);
    window.boardRouteStateByType[key] = {
        page: normalizeBoardPage(page, 1),
        keyword: normalizeBoardKeyword(keyword)
    };
    return window.boardRouteStateByType[key];
};

const parseHashRoute = (rawHash = window.location.hash) => {
    const hashValue = (typeof rawHash === 'string') ? rawHash : '';
    const currentHash = hashValue.startsWith('#') ? hashValue.substring(1) : hashValue;
    const querySplitIndex = currentHash.indexOf('?');
    const routePath = querySplitIndex >= 0 ? currentHash.substring(0, querySplitIndex) : currentHash;
    const queryText = querySplitIndex >= 0 ? currentHash.substring(querySplitIndex + 1) : '';

    let decodedRoutePath = routePath;
    try {
        decodedRoutePath = decodeURIComponent(routePath);
    } catch (e) {
        // ignore decode failure and keep raw path
    }

    const hashParts = decodedRoutePath.split('/');
    const pageCode = hashParts[0];
    const paramId = hashParts.length > 1 ? hashParts.slice(1).join('/') : '';
    const realPage = (typeof getPageFromCode === 'function') ? getPageFromCode(pageCode) : 'home';

    return {
        pageCode,
        paramId,
        realPage: realPage || 'home',
        params: new URLSearchParams(queryText)
    };
};

const buildBoardHash = (routePage, page, keyword) => {
    const safePage = normalizeBoardPage(page, 1);
    const safeKeyword = normalizeBoardKeyword(keyword);
    const params = new URLSearchParams();
    params.set('p', String(safePage));
    if (safeKeyword) params.set('q', safeKeyword);
    const code = (typeof ROUTE_MAP !== 'undefined' && ROUTE_MAP[routePage]) ? ROUTE_MAP[routePage] : routePage;
    return `#${code}?${params.toString()}`;
};

const resolveBoardNavigationState = (routePage) => {
    const boardType = boardTypeFromRoute(routePage);
    const storedState = getBoardRouteState(boardType);
    const parsedHash = parseHashRoute(window.location.hash);

    const hashMatchesBoard = isBoardRoutePage(parsedHash.realPage) && boardTypeFromRoute(parsedHash.realPage) === boardType;
    const statePage = history.state && typeof history.state.page === 'string' ? history.state.page : '';
    const stateMatchesBoard = isBoardRoutePage(statePage) && boardTypeFromRoute(statePage) === boardType;

    let page = storedState.page;
    let keyword = storedState.keyword;

    if (stateMatchesBoard) {
        page = normalizeBoardPage(history.state.boardPage, page);
        keyword = normalizeBoardKeyword(history.state.boardKeyword || keyword);
    }

    if (hashMatchesBoard) {
        page = normalizeBoardPage(parsedHash.params.get('p'), page);
        const keywordFromHash = normalizeBoardKeyword(parsedHash.params.get('q'));
        keyword = keywordFromHash || keyword;
    }

    const state = setBoardRouteState(boardType, page, keyword);
    return {
        boardType,
        routePage: routeFromBoardType(boardType),
        page: state.page,
        keyword: state.keyword
    };
};

window.parseAaHashRoute = parseHashRoute;
window.storeBoardRouteState = (boardType, page, keyword) => setBoardRouteState(boardType, page, keyword);
window.syncBoardRouteState = function(boardType, page, keyword) {
    const normalizedBoardType = boardTypeFromRoute(boardType);
    const routePage = routeFromBoardType(normalizedBoardType);
    const safePage = normalizeBoardPage(page, 1);
    const safeKeyword = normalizeBoardKeyword(keyword);
    setBoardRouteState(normalizedBoardType, safePage, safeKeyword);

    const currentHashState = parseHashRoute(window.location.hash);
    if (!isBoardRoutePage(currentHashState.realPage)) return;
    if (boardTypeFromRoute(currentHashState.realPage) !== normalizedBoardType) return;

    const nextHash = buildBoardHash(routePage, safePage, safeKeyword);
    const nextState = Object.assign({}, history.state || {}, {
        page: routePage,
        boardType: normalizedBoardType,
        boardPage: safePage,
        boardKeyword: safeKeyword
    });

    const currentState = history.state || {};
    const isUnchanged = window.location.hash === nextHash &&
        currentState.page === nextState.page &&
        currentState.boardType === nextState.boardType &&
        currentState.boardPage === nextState.boardPage &&
        (currentState.boardKeyword || '') === nextState.boardKeyword;

    if (!isUnchanged) {
        history.replaceState(nextState, null, nextHash);
    }
};

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

    const parsedHash = parseHashRoute(window.location.hash);
    const realPage = parsedHash.realPage;
    const paramId = parsedHash.paramId;

    if (realPage === 'detail' && paramId) {
        readPost(paramId);
    } else if (event.state && event.state.page) {
        window.router(event.state.page, false);
    } else {
        window.router(realPage, false);
    }
});

window.router = function(page, pushHistory = true) {
    try {
        window.dispatchEvent(new CustomEvent('aa:navigate', { detail: { page, pushHistory, ts: Date.now() } }));
    } catch (e) {
        // ignore
    }
    const boardNavState = isBoardRoutePage(page) ? resolveBoardNavigationState(page) : null;

    if(pushHistory) {
        if (page !== 'detail') {
            if (boardNavState) {
                history.pushState({
                    page: boardNavState.routePage,
                    boardType: boardNavState.boardType,
                    boardPage: boardNavState.page,
                    boardKeyword: boardNavState.keyword
                }, null, buildBoardHash(boardNavState.routePage, boardNavState.page, boardNavState.keyword));
            } else {
                const code = (typeof ROUTE_MAP !== 'undefined' && ROUTE_MAP[page]) ? ROUTE_MAP[page] : page;
                history.pushState({ page }, null, page === 'home' ? ' ' : `#${code}`);
            }
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
    
    if (boardNavState) {
        const boardInput = document.getElementById('boardSearchInput');
        if(boardInput) boardInput.value = boardNavState.keyword;
        fetchPosts(boardNavState.boardType, boardNavState.page);
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
