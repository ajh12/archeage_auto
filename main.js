import { RECAPTCHA_SITE_KEY, PAGE_SIZE, ROUTE_MAP } from './config.js';
import { getPageFromCode, saveLocalPosts, loadLocalPosts, loadSavedNickname, saveNickname, sha256, configureMarked, preprocessMarkdown, sanitizeContent } from './utils.js';
import { initSupabase, getDbClient, fetchClientIP, getClientIP, verifyCaptcha, recordVisit, fetchVersion } from './api.js';
import { router, showAlert, showConfirm, showContentModal, closeAlert, closeConfirm, renderPostList, renderPagination, renderPostDetail, renderComments, updateAdminUI, openLightbox, closeLightbox } from './ui.js';
import { switchEditorTab, updateMarkdownPreview, execCmd, insertMarkdown, saveSelection, processPostImage, processCommentImages, setupPasteHandlers } from './editor.js';
import * as Admin from './admin.js';

let posts = [];
let currentBoardType = 'error';
let isAdmin = false;
let lastPage = 'home';
let errorViewMode = 'grid';
let currentPostId = null;
let isWriting = false;
let editingPostId = null; 
let pendingActionType = null; 
let pendingTarget = null;
let pendingTargetId = null;
let editingCommentId = null;
let currentCommentImages = []; 
let replyingToCommentId = null; 
let replyingToCommentAuthor = null;
let currentEditorMode = 'html'; 
let currentPage = 1;
let totalCount = 0;
let isBanned = false;

window.currentEditorMode = 'html'; 

document.addEventListener('DOMContentLoaded', () => {
    configureMarked();
    setupPasteHandlers(
        (file) => processPostImage(file, currentEditorMode),
        (files) => processCommentImages(files, currentCommentImages, renderCommentImagePreview)
    );
    
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const loader = document.getElementById('global-loader');
    if(loader) loader.classList.remove('hidden');

    const confirmBtn = document.getElementById('btn-confirm-yes');
    if(confirmBtn) {
        confirmBtn.onclick = () => {
            if (window.confirmCallback) window.confirmCallback();
            closeConfirm();
        };
    }
    
    initSupabase((event, session) => {
        if (session) {
            isAdmin = true;
            updateAdminUI(isAdmin, loadSavedNickname);
            Admin.updateAdminStats();
        } else {
            isAdmin = false;
            updateAdminUI(isAdmin, loadSavedNickname);
        }
    });

    fetchClientIP();
    fetchVersion().then(v => {
        if(v) document.getElementById('version-text').innerText = "최신버전  " + v;
    });

    attachGlobalFunctions();
});

window.onload = () => { 
    const loader = document.getElementById('global-loader');
    if(loader) loader.classList.remove('hidden');

    loadLocalPostsData(); 
    const initialHash = window.location.hash.replace('#', '');
    const realPage = getPageFromCode(initialHash); 
    
    if (realPage === 'detail') { 
        const savedId = localStorage.getItem('aa_current_post_id');
        if (savedId) {
            readPost(savedId).then(() => {
                if(loader) setTimeout(() => loader.classList.add('hidden'), 300);
            }).catch(() => {
                router('home', false);
                if(loader) setTimeout(() => loader.classList.add('hidden'), 300);
            });
        } else {
            router('home', false);
            if(loader) setTimeout(() => loader.classList.add('hidden'), 300);
        }
    } else {
        router(realPage, isAdmin);
        if(loader) setTimeout(() => loader.classList.add('hidden'), 300);
    }
    
    recordVisit(); 
};

window.addEventListener('popstate', (event) => {
    if (event.state && event.state.page) {
        window.router(event.state.page, false);
    } else {
        window.router('home', false);
    }
});

function loadLocalPostsData() { 
    posts = loadLocalPosts(); 
}

async function fetchPosts(type, page = 1) {
    const dbClient = getDbClient();
    if (!dbClient) {
        loadLocalPostsData();
        renderBoard();
        return;
    }
    
    currentBoardType = type;
    currentPage = page;
    
    const spinner = document.getElementById('loading-spinner');
    if(spinner) spinner.classList.remove('hidden');
    
    const keyword = document.getElementById('boardSearchInput').value.trim();
    
    let query = dbClient.from('posts').select('*, comments(*)', { count: 'exact' }).eq('type', type).is('deleted_at', null).order('is_pinned', { ascending: false }).order('created_at', { ascending: false });

    if (keyword) {
        query = query.or(`title.ilike.%${keyword}%,author.ilike.%${keyword}%`);
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count, error } = await query.range(from, to);

    if (error) { 
        if(posts.length === 0) loadLocalPostsData();
        renderBoard();
    } else {
        totalCount = count || 0;
        posts = data.map(p => ({
            ...p,
            date: new Date(p.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            comments: (p.comments || []).filter(c => !c.deleted_at),
            reports: p.reports || 0,
            reported_by: Array.isArray(p.reported_by) ? p.reported_by : [] 
        }));
        saveLocalPosts(posts);
        renderBoard();
        renderPagination('pagination-container', totalCount, PAGE_SIZE, currentPage, (p) => fetchPosts(currentBoardType, p)); 
    }
    if(isAdmin) Admin.updateAdminStats();
    if(spinner) spinner.classList.add('hidden');
}

function renderBoard() {
    const container = document.getElementById('board-container');
    const titles = { notice: {t:'📢 공지사항', d:'중요 업데이트 및 안내'}, free: {t:'💬 자유대화방', d:'자유로운 소통 공간'}, error: {t:'🛠️ 오류해결소', d:'오류 질문 및 해결법 공유'} };
    document.getElementById('board-title').innerText = titles[currentBoardType].t;
    document.getElementById('board-desc').innerText = titles[currentBoardType].d;
    document.getElementById('view-toggles').classList.toggle('hidden', currentBoardType !== 'error');
    document.getElementById('btn-write-board').classList.toggle('hidden', currentBoardType === 'notice' && !isAdmin);

    if (currentBoardType === 'error') {
        document.getElementById('btn-grid').classList.toggle('view-btn-active', errorViewMode === 'grid');
        document.getElementById('btn-list').classList.toggle('view-btn-active', errorViewMode === 'list');
    }

    renderPostList(posts, 'board-container', errorViewMode, currentBoardType, isAdmin);
}

async function readPost(id, directData = null) {
    const dbClient = getDbClient();
    localStorage.setItem('aa_current_post_id', id);
    const viewedKey = `viewed_post_${id}_${getClientIP() || 'unknown'}`;
    
    if(dbClient && !localStorage.getItem(viewedKey)) {
        try {
            const { error } = await dbClient.rpc('increment_views', { row_id: id });
            if(!error) {
                const targetPost = posts.find(p => p.id == id);
                if (targetPost) {
                    targetPost.views = (targetPost.views || 0) + 1; 
                    dbClient.from('posts').update({ views: targetPost.views }).eq('id', id);
                }
                localStorage.setItem(viewedKey, 'true'); 
            }
        } catch (e) {}
    }
    
    let post = directData || posts.find(p => p.id == id);

    if (!post && dbClient) {
        try {
            const { data, dataError } = await dbClient.from('posts').select('*, comments(*)').eq('id', id).single();
            if (data) {
                post = {
                    ...data,
                    date: new Date(data.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    comments: (data.comments || []).filter(c => !c.deleted_at),
                    reported_by: Array.isArray(data.reported_by) ? data.reported_by : []
                };
            }
        } catch (e) {}
    }

    if (!post) return window.router('list');
    
    currentPostId = id;
    renderPostDetail(post, isAdmin);
    
    const btnDelete = document.getElementById('btn-force-delete');
    const btnEdit = document.getElementById('btn-edit-post');
    if(btnDelete) {
        btnDelete.classList.remove('hidden');
        btnDelete.onclick = () => requestPasswordCheck(id, 'delete_post');
    }
    if(btnEdit) {
        btnEdit.classList.remove('hidden');
        btnEdit.onclick = () => requestPasswordCheck(id, 'edit_post');
    }

    const commentWriteArea = document.getElementById('comment-write-area');
    if(commentWriteArea) {
        commentWriteArea.classList.toggle('hidden', post.type === 'notice');
    }

    cancelReply();
    renderComments(post.comments || [], 'comment-list', isAdmin);
    window.router('detail');
}

async function submitPost() {
    const dbClient = getDbClient();
    const t = document.getElementById('inputTitle').value.trim(); 
    let n = document.getElementById('inputName').value.trim(); 
    let pw = document.getElementById('inputPw').value.trim(); 
    
    let finalContent = "";
    if (currentEditorMode === 'html') {
        finalContent = document.getElementById('editorContentHtml').innerHTML;
    } else {
        finalContent = document.getElementById('editorContentMarkdown').value;
    }
    
    let thumb = null;
    const imgMatch = finalContent.match(/<img[^>]+src=["']([^"']+)["']/);
    const mdImgMatch = finalContent.match(/!\[.*?\]\((.*?)\)/);
    
    if (imgMatch && imgMatch[1]) thumb = imgMatch[1];
    else if (mdImgMatch && mdImgMatch[1]) thumb = mdImgMatch[1];

    if(!t) return showAlert('제목을 입력하세요.'); 
    const textCheck = finalContent.replace(/<[^>]*>/g, '').trim();
    if(!textCheck && !thumb) return showAlert('내용을 입력하세요.');

    if (!isAdmin && typeof grecaptcha !== 'undefined' && RECAPTCHA_SITE_KEY) {
        try {
            const token = await new Promise((resolve) => {
                grecaptcha.ready(() => {
                    grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit_post' })
                        .then(token => resolve(token))
                        .catch(err => { console.error(err); resolve(null); });
                });
            });

            if (!token) return showAlert("캡차 토큰 생성에 실패했습니다. 새로고침 후 다시 시도해주세요.");
            
            const isVerified = await verifyCaptcha(token);
            if (!isVerified) {
                return showAlert(
                    "보안 검증에 실패했습니다.\n\n" +
                    "1. 현재 '시크릿 모드'를 사용 중이라면 해제해주세요.\n" +
                    "2. VPN이나 광고 차단 확장 프로그램을 끄고 시도해주세요.\n\n"
                );
            }
            
        } catch (e) {
            console.error("Captcha error:", e);
            return showAlert("캡차 인증 중 시스템 오류가 발생했습니다.");
        }
    }

    if(isAdmin) { n = "하포카"; pw = ""; } 
    else {
        const banned = ['admin', '하포카', '관리자', '관리인'];
        if(banned.includes(n.toLowerCase())) return showAlert("사용할 수 없는 닉네임입니다.");
        if(!editingPostId && !/^[a-zA-Z0-9]{4,10}$/.test(pw)) return showAlert('비밀번호는 영문+숫자 4~10자여야 합니다.');
        if(!n) n = '익명';
    }

    let postData = { title: t, content: finalContent, image: thumb };
    if(!editingPostId) {
        postData.author = n;
        postData.password = pw;
        postData.type = currentBoardType;
    }

    document.getElementById('global-loader').classList.remove('hidden');
    
    const isPinned = document.getElementById('checkPinned').checked;
    if(!isAdmin) saveNickname(postData.author);

    try {
        if (editingPostId) {
            if(!dbClient) return showAlert("오프라인 상태에서는 수정할 수 없습니다.");
            const { error } = await dbClient.rpc('update_post_secure', {
                p_id: editingPostId,
                p_title: postData.title,
                p_content: postData.content,
                p_image_url: postData.image,
                p_is_pinned: isAdmin ? isPinned : false
            });
            if (error) throw error;
            showAlert("수정되었습니다.");
            isWriting = false;
            
            const targetId = editingPostId;
            resetEditor();
            setTimeout(() => { readPost(targetId); document.getElementById('global-loader').classList.add('hidden'); }, 100);
            return;
        }

        let finalPw = postData.password;
        if(!isAdmin && finalPw) finalPw = await sha256(finalPw);

        const { error } = await dbClient.rpc('create_post_secure', {
            p_title: postData.title,
            p_content: postData.content,
            p_author: postData.author,
            p_password: finalPw,
            p_type: postData.type,
            p_image_url: postData.image,
            p_is_pinned: isAdmin ? isPinned : false
        });
        if (error) throw error;
        
        showAlert('등록되었습니다.');
        isWriting = false;
        resetEditor();
        window.router(currentBoardType, isAdmin);
        document.getElementById('global-loader').classList.add('hidden'); 

    } catch (e) {
        document.getElementById('global-loader').classList.add('hidden'); 
        showAlert("오류: " + e.message);
    }
}

async function submitComment() {
    const dbClient = getDbClient();
    let name = document.getElementById('cmtName').value.trim();
    let contentText = document.getElementById('cmtContent').value; 
    let pw = document.getElementById('cmtPw').value.trim();

    if(!contentText.trim() && currentCommentImages.length === 0) return showAlert("내용을 입력하세요.");

    // --- 캡차 검증 부분 수정 ---
    if (!isAdmin && typeof grecaptcha !== 'undefined' && RECAPTCHA_SITE_KEY) {
        try {
            const token = await new Promise((resolve) => {
                grecaptcha.ready(() => {
                    grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit_comment' })
                        .then(token => resolve(token))
                        .catch(err => { console.error(err); resolve(null); });
                });
            });

            if (!token) return showAlert("캡차 토큰 생성에 실패했습니다.");

            const isVerified = await verifyCaptcha(token);
            if (!isVerified) {
                return showAlert(
                    "보안 검증(봇 탐지)에 실패했습니다.\n\n" +
                    "1. 현재 '시크릿 모드'를 사용 중이라면 해제해주세요.\n" +
                    "2. VPN이나 광고 차단 확장 프로그램을 끄고 시도해주세요.\n\n" +
                    "(Google reCAPTCHA 점수 미달)", 
                    "보안 경고"
                );
            }
        } catch (e) {
            console.error("Captcha error:", e);
            return showAlert("캡차 인증 중 오류가 발생했습니다.");
        }
    }

    if (isBanned) return showAlert("차단된 사용자는 댓글을 쓸 수 없습니다.");

    let imageHtml = '';
    if(currentCommentImages.length > 0) {
        imageHtml = '<div class="comment-img-container">';
        currentCommentImages.forEach(src => { imageHtml += `<img src="${src}" class="comment-img-thumb" onclick="openLightbox(this.src)">`; });
        imageHtml += '</div>';
    }
    
    let parentTag = replyingToCommentId ? `<!-- parent_id:${replyingToCommentId} -->` : '';
    let finalContent = contentText.replace(/\n/g, '<br>') + imageHtml + parentTag;

    if(!isAdmin) saveNickname(name);

    if(editingCommentId && dbClient) {
        const { error } = await dbClient.from('comments').update({ content: finalContent }).eq('id', editingCommentId);
        if(error) showAlert("수정 실패");
        else {
            const post = posts.find(p => p.id == currentPostId);
            const cmtIndex = post.comments.findIndex(c => c.id == editingCommentId);
            if(cmtIndex !== -1) post.comments[cmtIndex].content = finalContent;
            renderComments(post.comments, 'comment-list', isAdmin);
            cancelCommentEdit();
        }
        return;
    }

    if(isAdmin) { name = "하포카"; pw = ""; }
    else {
        if(!name) return showAlert("닉네임 입력");
        if(!pw) return showAlert("비번 입력");
    }

    let finalPw = pw;
    if(!isAdmin && pw) finalPw = await sha256(pw);

    document.getElementById('global-loader').classList.remove('hidden');
    try {
        const { data, error } = await dbClient.rpc('create_comment_secure', {
            p_post_id: currentPostId,
            p_author: name,
            p_password: finalPw,
            p_content: finalContent
        });

        if(error) throw error;
        const post = posts.find(p => p.id == currentPostId);
        if(!post.comments) post.comments = [];
        post.comments.push(data);
        renderComments(post.comments, 'comment-list', isAdmin);
        
        document.getElementById('cmtContent').value = '';
        document.getElementById('cmtPw').value = '';
        currentCommentImages = [];
        renderCommentImagePreview();
        cancelReply(); 
    } catch (e) { showAlert("실패: " + e.message); } 
    finally { document.getElementById('global-loader').classList.add('hidden'); }
}

function renderCommentImagePreview() {
    const container = document.getElementById('cmtImagePreview');
    if(currentCommentImages.length > 0) {
        container.classList.remove('hidden');
        container.innerHTML = '';
        currentCommentImages.forEach((src, idx) => {
            container.innerHTML += `<div class="cmt-preview-item"><img src="${src}"><div class="cmt-preview-remove" onclick="window.removeCommentImage(${idx})"><i class="fa-solid fa-xmark"></i></div></div>`;
        });
    } else {
        container.classList.add('hidden');
        container.innerHTML = '';
    }
}

function requestPasswordCheck(targetId, actionType) {
    let target = null;
    if(actionType.includes('post')) {
        target = posts.find(p => p.id == targetId);
    } else {
        const currentPost = posts.find(p => p.id == currentPostId);
        target = currentPost.comments.find(c => c.id == targetId || c.created_at == targetId); 
    }

    if (!target) return showAlert("항목을 찾을 수 없습니다.");
    if(isAdmin) { executeAction(actionType, targetId, target); return; }
    if(target.author === '하포카' || target.author === 'Admin') return showAlert("관리자 항목은 수정불가");

    pendingActionType = actionType;
    pendingTargetId = targetId;
    pendingTarget = target; 
    document.getElementById('verificationPw').value = '';
    document.getElementById('passwordModal').classList.remove('hidden');
    document.getElementById('verificationPw').focus();
}

async function confirmPasswordAction() {
    const inputPw = document.getElementById('verificationPw').value;
    if(!inputPw) return showAlert("비밀번호 입력 필요");
    if (!pendingTarget) return closePasswordModal();
    
    const hashedInput = await sha256(inputPw);
    const isMatch = (pendingTarget.password === inputPw) || (pendingTarget.password === hashedInput);

    if(isMatch) {
        const a = pendingActionType;
        const i = pendingTargetId;
        const t = pendingTarget;
        document.getElementById('passwordModal').classList.add('hidden');
        pendingActionType = null;
        setTimeout(() => executeAction(a, i, t), 300);
    } else {
        showAlert("비밀번호 불일치");
        document.getElementById('verificationPw').value = '';
    }
}

function executeAction(type, id, targetObj) {
    if(type === 'delete_post') showConfirm("삭제하시겠습니까?", () => deletePost(id), "삭제", "삭제하기");
    else if(type === 'edit_post') goEditMode(targetObj);
    else if(type === 'delete_comment') showConfirm("삭제하시겠습니까?", () => deleteComment(id), "삭제", "삭제하기");
    else if(type === 'edit_comment') loadCommentForEdit(targetObj);
}

function goEditMode(post) {
    editingPostId = post.id;
    currentBoardType = post.type;
    document.getElementById('write-header').innerText = "글 수정하기";
    document.getElementById('inputTitle').value = post.title;
    currentEditorMode = 'html';
    document.getElementById('editorContentHtml').innerHTML = post.content;
    document.getElementById('editorContentMarkdown').value = post.content; 
    document.getElementById('inputName').value = post.author;
    document.getElementById('inputName').disabled = true;
    document.getElementById('inputPw').disabled = true;
    
    if(isAdmin) document.getElementById('checkPinned').checked = post.is_pinned || false;
    
    switchEditorTab('html');
    window.router('write', isAdmin);
}

async function deletePost(id) { 
    const dbClient = getDbClient();
    if(dbClient) { 
        await dbClient.from('posts').update({ deleted_at: new Date().toISOString(), status: 'deleted' }).eq('id', id);
        if(!document.getElementById('view-detail').classList.contains('hidden')) fetchPosts(currentBoardType); 
    } else { 
        posts = posts.filter(p => p.id != id); 
        saveLocalPosts(posts); 
        renderBoard(); 
    }
    showAlert("삭제되었습니다.");
    if(!document.getElementById('view-detail').classList.contains('hidden')) window.router(currentBoardType, isAdmin);
}

async function deleteComment(id) {
    const dbClient = getDbClient();
    if(dbClient) {
        const { error } = await dbClient.from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', id);
        if(error) showAlert("삭제 실패");
        else {
            showAlert("삭제되었습니다.");
            const post = posts.find(p => p.id == currentPostId);
            if(post && post.comments) {
                const idx = post.comments.findIndex(c => c.id == id);
                if(idx !== -1) post.comments.splice(idx, 1);
            }
            renderComments(post ? post.comments : [], 'comment-list', isAdmin);
        }
    }
}

function attachGlobalFunctions() {
    window.router = function(page, pushHistory = true) {
        if(pushHistory) {
            const code = ROUTE_MAP[page] || page;
            history.pushState({ page }, null, page === 'home' ? ' ' : `#${code}`);
        }
        router(page, isAdmin);
        lastPage = page;
        isWriting = (page === 'write');
    };
    
    window.readPost = readPost;
    window.changePage = (p) => fetchPosts(currentBoardType, p);
    window.toggleViewMode = (mode) => { errorViewMode = mode; renderBoard(); };
    window.writePost = (type) => {
        document.getElementById('categoryModal').classList.add('hidden');
        currentBoardType = type;
        editingPostId = null;
        document.getElementById('write-header').innerText = "글쓰기";
        document.getElementById('inputTitle').value=''; 
        document.getElementById('inputName').value= loadSavedNickname();
        document.getElementById('inputName').disabled=false;
        document.getElementById('inputPw').value='';
        document.getElementById('editorContentHtml').innerHTML='';
        switchEditorTab('html');
        window.router('write');
    };
    
    window.confirmNavigation = (target) => {
        if(target === 'back') target = lastPage;
        if(isWriting || document.getElementById('cmtContent').value.trim()) {
            showConfirm("작성 중인 내용이 사라집니다. 이동할까요?", () => window.router(target), "이동", "이동");
        } else {
            window.router(target);
        }
    };

    window.submitPost = submitPost;
    window.submitComment = submitComment;
    window.requestPasswordCheck = requestPasswordCheck;
    window.confirmPasswordAction = confirmPasswordAction;
    window.closePasswordModal = () => document.getElementById('passwordModal').classList.add('hidden');
    window.closeConfirm = closeConfirm;
    window.closeAlert = closeAlert;
    
    window.replyToComment = (id, author) => {
        replyingToCommentId = id;
        document.getElementById('reply-target-msg').innerText = author;
        document.getElementById('reply-target-box').classList.remove('hidden');
    };
    window.reportComment = async (id) => {
        const dbClient = getDbClient();
        if(!dbClient) return showAlert("오프라인 불가");
        showConfirm("신고하시겠습니까?", async () => {
            const { error } = await dbClient.rpc('report_content_secure', { p_type: 'comment', p_id: id });
            if(error) showAlert(error.message); else showAlert("신고 접수됨");
        }, "신고", "신고");
    };
    window.removeCommentImage = (idx) => {
        currentCommentImages.splice(idx, 1);
        renderCommentImagePreview();
    };
    
    window.tryAdminLogin = async () => {
        const e = document.getElementById('adminEmail').value;
        const p = document.getElementById('adminPw').value;
        const dbClient = getDbClient();
        if(dbClient) {
            const { error } = await dbClient.auth.signInWithPassword({ email: e, password: p });
            if(error) showAlert(error.message);
            else { document.getElementById('adminModal').classList.add('hidden'); showAlert("로그인 성공"); }
        }
    };
    window.adminLogout = () => {
        const dbClient = getDbClient();
        if(dbClient) dbClient.auth.signOut();
        isAdmin = false;
        updateAdminUI(isAdmin, loadSavedNickname);
        window.router('home');
    };

    window.switchAdminTab = Admin.switchAdminTab;
    window.toggleSelectAll = Admin.toggleSelectAll;
    window.restorePost = Admin.restorePost;
    window.permanentlyDeletePost = Admin.permanentlyDeletePost;
    window.restoreComment = Admin.restoreComment;
    window.permanentlyDeleteComment = Admin.permanentlyDeleteComment;
    window.adminSearchByIp = Admin.adminSearchByIp;
    window.clearReports = Admin.clearReports;
    window.removeBan = Admin.removeBan;
    
    window.execCmd = execCmd;
    window.switchEditorTab = (tab) => { currentEditorMode = switchEditorTab(tab); };
    window.insertImage = (inp) => { if(inp.files[0]) processPostImage(inp.files[0], currentEditorMode); inp.value=''; };
    
    window.openLightbox = openLightbox;
    window.closeLightbox = closeLightbox;
    window.toggleMobileMenu = () => document.getElementById('mobile-menu').classList.toggle('hidden');
    window.openCategoryModal = () => document.getElementById('categoryModal').classList.remove('hidden');
    window.closeCategoryModal = () => document.getElementById('categoryModal').classList.add('hidden');
    window.openAdminLogin = () => { if(!isAdmin) document.getElementById('adminModal').classList.remove('hidden'); };
    window.closeAdminModal = () => document.getElementById('adminModal').classList.add('hidden');
}

function cancelReply() {
    replyingToCommentId = null;
    document.getElementById('reply-target-box').classList.add('hidden');
}

function resetEditor() { 
    document.getElementById('inputTitle').value=''; 
    document.getElementById('inputName').value=''; 
    document.getElementById('inputPw').value=''; 
    document.getElementById('editorContentHtml').innerHTML='';
    editingPostId = null;
}

function loadCommentForEdit(cmt) {
    editingCommentId = cmt.id;
    document.getElementById('cmtName').value = cmt.author;
    document.getElementById('cmtName').disabled = true;
    document.getElementById('cmtPw').classList.add('hidden'); 
    let tempDiv = document.createElement('div');
    tempDiv.innerHTML = cmt.content;
    currentCommentImages = [];
    tempDiv.querySelectorAll('img').forEach(img => currentCommentImages.push(img.src));
    document.getElementById('cmtContent').value = tempDiv.innerText.trim();
    document.getElementById('btn-submit-cmt').innerText = "수정완료";
    document.getElementById('btn-cmt-cancel').classList.remove('hidden');
    renderCommentImagePreview();
}

function cancelCommentEdit() {
    editingCommentId = null;
    document.getElementById('cmtName').value = isAdmin ? "하포카" : loadSavedNickname();
    document.getElementById('cmtName').disabled = isAdmin;
    if(!isAdmin) document.getElementById('cmtPw').classList.remove('hidden');
    document.getElementById('cmtPw').value = "";
    document.getElementById('cmtContent').value = "";
    document.getElementById('btn-submit-cmt').innerText = "등록";
    document.getElementById('btn-cmt-cancel').classList.add('hidden');
    currentCommentImages = [];
    renderCommentImagePreview();
}
