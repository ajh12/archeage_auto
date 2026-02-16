var dbClient = null;
var clientIP = "1.2.3.4";

function initSupabase(authCallback) {
    try {
        if(SUPABASE_URL && SUPABASE_ANON_KEY) {
            const { createClient } = window.supabase; 
            dbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            
            if (authCallback) {
                dbClient.auth.onAuthStateChange(authCallback);
            }
            return dbClient;
        }
    } catch(e) {
        console.error("Supabase init error:", e);
    }
    return null;
}

function getDbClient() { return dbClient; }

async function fetchClientIP() {
    try {
        const response = await fetch('https://api64.ipify.org?format=json');
        const data = await response.json();
        if(data && data.ip) clientIP = data.ip;
    } catch (e) {
        console.error("IP fetch failed", e);
    }
    return clientIP;
}

function getClientIP() { return clientIP; }

async function verifyCaptcha(token) {
    if (!dbClient) return false;
    
    try {
        const functionUrl = `${SUPABASE_URL}/functions/v1/verify-captcha`;
        
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ token })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Captcha verification failed:', errorText);
            return false;
        }

        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Captcha error:', error);
        return false;
    }
}

async function recordVisit() {
    const dbClient = getDbClient();
    if(!dbClient) return;

    const today = new Date().toISOString().split('T')[0];
    const lastVisitKey = 'aa_last_visit_date';
    const lastVisit = localStorage.getItem(lastVisitKey);
    
    if(lastVisit !== today) {
        localStorage.setItem(lastVisitKey, today);
        try {
            const { data, error } = await dbClient.from('daily_stats').select('*').eq('date', today).single();
            
            if(error && error.code === 'PGRST116') {
                await dbClient.from('daily_stats').insert([{ date: today, visitors: 1 }]);
            } else if(data) {
                await dbClient.from('daily_stats').update({ visitors: data.visitors + 1 }).eq('date', today);
            }
        } catch(e) {}
    }
}

async function fetchVersion() {
    try {
        const r = await fetch('https://raw.githubusercontent.com/Pretsg/Archeage_auto/main/version.txt');
        const t = await r.text();
        let v = t.trim().split(/\s+/)[0]; 
        if(v && !v.toLowerCase().startsWith('v')) v = 'v' + v;
        return v || 'v0.1';
    } catch(e) {
        return null;
    }
}

async function fetchTopNotice() {
    if (typeof TOP_NOTICE === 'undefined' || !TOP_NOTICE.enabled || !TOP_NOTICE.useGithub || !TOP_NOTICE.githubUrl) {
        return null;
    }
    try {
        const r = await fetch(TOP_NOTICE.githubUrl + '?t=' + Date.now());
        if (!r.ok) return null;
        const text = await r.text();
        return text.trim();
    } catch (e) {
        return null;
    }
}

async function uploadImage(file) {
    if (!dbClient) return null;
    const fileName = `img_${Date.now()}_${Math.random().toString(36).substring(2)}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
    
    try {
        const { data, error } = await dbClient.storage
            .from('images')
            .upload(fileName, file);

        if (error) throw error;
        
        const { data: publicData } = dbClient.storage
            .from('images')
            .getPublicUrl(fileName);
            
        return publicData.publicUrl;
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
}

function loadLocalPostsData() { 
    posts = loadLocalPosts(); 
}

async function fetchPosts(type, page = 1) {
    if (type === 'test' && !isAdmin) {
         showAlert("접근 권한이 없습니다.");
         return window.router('home');
    }

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
    
    const container = document.getElementById('board-container');
    if(container) container.innerHTML = '';

    const titles = { 
        notice: {t:'📢 공지사항', d:'중요 업데이트 및 안내'}, 
        free: {t:'💬 자유대화방', d:'자유로운 소통 공간'}, 
        error: {t:'🛠️ 오류해결소', d:'오류 질문 및 해결법 공유'},
        test: {t:'🧪 테스트 게시판', d:'관리자 전용 테스트 공간'}
    };
    const tEl = document.getElementById('board-title');
    const dEl = document.getElementById('board-desc');
    if(tEl && titles[currentBoardType]) tEl.innerText = titles[currentBoardType].t;
    if(dEl && titles[currentBoardType]) dEl.innerText = titles[currentBoardType].d;
    
    const toggles = document.getElementById('view-toggles');
    if(toggles) toggles.classList.toggle('hidden', currentBoardType !== 'error');
    const writeBtn = document.getElementById('btn-write-board');
    if(writeBtn) writeBtn.classList.toggle('hidden', currentBoardType === 'notice' && !isAdmin);
    
    const keyword = document.getElementById('boardSearchInput').value.trim();
    
    let query = dbClient.from('posts').select('*, comments(*)', { count: 'exact' }).eq('type', type).is('deleted_at', null).order('is_pinned', { ascending: false }).order('created_at', { ascending: false });

    if (keyword) {
        query = query.or(`title.ilike.%${keyword}%,author.ilike.%${keyword}%`);
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count, error } = await query.range(from, to);

    if (error) { 
        console.error("DB Fetch Error:", error); 
        if(posts.length === 0) loadLocalPostsData();
        renderBoard();
    } else {
        totalCount = count || 0;
        posts = data.map(p => {
            let version = null;
            const match = p.content ? p.content.match(/<!-- version:(.*?) -->/) : null;
            if(match && match[1]) version = match[1];

            return {
                ...p,
                game_version: version, 
                date: new Date(p.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                comments: (p.comments || []).filter(c => !c.deleted_at),
                reports: p.reports || 0,
                reported_by: Array.isArray(p.reported_by) ? p.reported_by : [] 
            };
        });
        saveLocalPosts(posts);
        renderBoard();
        renderPagination('pagination-container', totalCount, PAGE_SIZE, currentPage, (p) => fetchPosts(currentBoardType, p)); 
    }
    if(isAdmin) updateAdminStats();
    if(spinner) spinner.classList.add('hidden');
}

async function readPost(id, directData = null) {
    const dbClient = getDbClient();
    localStorage.setItem('aa_current_post_id', id);
    
    const detailCode = (typeof ROUTE_MAP !== 'undefined' && ROUTE_MAP['detail']) ? ROUTE_MAP['detail'] : 'detail';
    const newUrl = `#${detailCode}/${id}`;
    
    if (window.location.hash !== newUrl) {
        history.pushState({ page: 'detail', id: id }, null, newUrl);
    }

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
    
    let post = directData; 

    if (dbClient) {
        try {
            const { data, dataError } = await dbClient.from('posts').select('*, comments(*)').eq('id', id).single();
            if (data) {
                let version = null;
                const match = data.content ? data.content.match(/<!-- version:(.*?) -->/) : null;
                if(match && match[1]) version = match[1];

                post = {
                    ...data,
                    game_version: version,
                    date: new Date(data.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    comments: (data.comments || []).filter(c => !c.deleted_at),
                    reported_by: Array.isArray(data.reported_by) ? data.reported_by : []
                };
            }
        } catch (e) {}
    }

    if (!post) {
         post = posts.find(p => p.id == id);
    }

    if (!post) {
        return window.router(currentBoardType || 'list');
    }
    
    if (post.type) {
        currentBoardType = post.type;
        lastPage = post.type === 'error' ? 'list' : post.type;
    }

    currentPostId = id;
    renderPostDetail(post, isAdmin);
    
    const likeCountEl = document.getElementById('like-count');
    if (likeCountEl && post.likes !== undefined) {
        likeCountEl.innerText = post.likes;
    }

    if (typeof initLikeButton === 'function') {
        await initLikeButton(id);
    }

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
    
    const uiRouter = (typeof window.router === 'function') ? window.router : null;
    if (uiRouter && typeof uiRouter === 'function') {
        uiRouter('detail', false);
    }
}

async function performSearch(keyword, searchType) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById('view-search').classList.remove('hidden');
    window.scrollTo(0,0);
    
    if(lastPage !== 'search') history.pushState({ page: 'search' }, null, `#${ROUTE_MAP['search'] || 'search'}`);
    lastPage = 'search'; 

    const kDisplay = document.querySelector('#search-keyword-display span');
    if(kDisplay) kDisplay.innerText = keyword;
    
    const container = document.getElementById('search-results-container');
    container.innerHTML = '';
    document.getElementById('loading-spinner').classList.remove('hidden');

    const dbClient = getDbClient();
    let queryResults = [];

    if(dbClient) {
        let query = dbClient.from('posts').select('*').is('deleted_at', null).neq('type', 'test').order('created_at', {ascending: false});
        if (searchType === 'nickname') {
            query = query.ilike('author', `%${keyword}%`);
        } else {
            query = query.or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%`);
        }
        const { data, error } = await query;
        if(!error && data) queryResults = data;
    } else {
        if (searchType === 'nickname') {
            queryResults = posts.filter(p => p.author.toLowerCase().includes(keyword.toLowerCase()) && !p.deleted_at && p.type !== 'test');
        } else {
            queryResults = posts.filter(p => (p.title.toLowerCase().includes(keyword.toLowerCase()) || p.content.toLowerCase().includes(keyword.toLowerCase())) && !p.deleted_at && p.type !== 'test');
        }
    }
    
    renderSearchResults(queryResults, keyword);
    document.getElementById('loading-spinner').classList.add('hidden');
}

async function submitPost() {
    const dbClient = getDbClient();
    const t = document.getElementById('inputTitle').value.trim(); 
    let n = document.getElementById('inputName').value.trim(); 
    let pw = document.getElementById('inputPw').value.trim(); 
    
    let selectedVersion = null;
    if (currentBoardType === 'test' || currentBoardType === 'free') {
        selectedVersion = document.getElementById('selectedGameVersion').value;
        if (!selectedVersion) return showAlert('버전을 선택해주세요 (1.2 / 5.0 / 공통).');
    }

    let finalContent = "";
    let textCheck = "";

    if (currentEditorMode === 'html') {
        finalContent = document.getElementById('editorContentHtml').innerHTML;
        const hasMedia = /<(img|iframe|video|embed|object)/i.test(finalContent);
        const textOnly = document.getElementById('editorContentHtml').innerText.replace(/\s/g, '');
        if (!textOnly && !hasMedia) textCheck = ""; 
        else textCheck = "ok";
    } else {
        finalContent = document.getElementById('editorContentMarkdown').value;
        textCheck = finalContent.trim();
    }
    
    let thumb = null;
    const imgMatch = finalContent.match(/<img[^>]+src=["']([^"']+)["']/);
    const mdImgMatch = finalContent.match(/!\[.*?\]\((.*?)\)/);
    
    if (imgMatch && imgMatch[1]) thumb = imgMatch[1];
    else if (mdImgMatch && mdImgMatch[1]) thumb = mdImgMatch[1];

    if(!t) return showAlert('제목을 입력하세요.'); 
    if(!textCheck && !thumb) return showAlert('내용을 입력하세요.');

    finalContent = finalContent.replace(/<!-- version:.*? -->/g, '');
    if (selectedVersion) {
        finalContent = `<!-- version:${selectedVersion} -->` + finalContent;
    }

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
                    "보안 검증(봇 탐지)에 실패했습니다.\n\n" +
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

            let updateSuccess = false;
            let errorMsg = "";

            const { error: rpcError } = await dbClient.rpc('update_post_secure', {
                p_id: editingPostId,
                p_title: postData.title,
                p_content: postData.content,
                p_image_url: postData.image,
                p_is_pinned: isAdmin ? isPinned : false
            });

            if (!rpcError) {
                updateSuccess = true;
            } else {
                errorMsg = rpcError.message;
                console.warn("RPC update failed, trying direct update:", rpcError);
            }
            
            if (!updateSuccess) {
                const { error: updateError } = await dbClient.from('posts').update({ 
                    title: postData.title, 
                    content: postData.content, 
                    image_url: postData.image, 
                    is_pinned: isAdmin ? isPinned : false
                }).eq('id', editingPostId);

                if (!updateError) {
                    updateSuccess = true;
                } else {
                    errorMsg = updateError.message;
                }
            }

            if (!updateSuccess) {
                throw new Error("수정 실패: " + errorMsg);
            }

            showAlert("수정되었습니다.");
            window.isWriting = false; 
            
            const oldPost = posts.find(p => p.id == editingPostId) || {};
            const updatedPost = {
                ...oldPost,
                id: editingPostId,
                title: postData.title,
                content: postData.content,
                image_url: postData.image,
                image: postData.image,
                is_pinned: isAdmin ? isPinned : (oldPost.is_pinned || false),
                game_version: selectedVersion 
            };

            const idx = posts.findIndex(p => p.id == editingPostId);
            if (idx !== -1) {
                posts[idx] = updatedPost;
            } else {
                posts.unshift(updatedPost);
            }
            saveLocalPosts(posts);

            const targetId = editingPostId;
            resetEditor();
            localStorage.removeItem('tempPost');

            setTimeout(() => { 
                readPost(targetId, updatedPost); 
                document.getElementById('global-loader').classList.add('hidden'); 
            }, 100);
            return;
        }

        let finalPw = postData.password;
        if(!isAdmin && finalPw) finalPw = await sha256(finalPw);

        const { data: newPostId, error } = await dbClient.rpc('create_post_secure', {
            p_title: postData.title,
            p_content: postData.content,
            p_author: postData.author,
            p_password: finalPw,
            p_type: postData.type,
            p_image_url: postData.image,
            p_is_pinned: isAdmin ? isPinned : false
        });
        
        if (error) throw error;
        
        const newPost = {
            id: newPostId,
            title: postData.title,
            content: postData.content,
            image_url: postData.image,
            author: postData.author,
            type: postData.type,
            created_at: new Date().toISOString(),
            is_pinned: isAdmin ? isPinned : false,
            game_version: selectedVersion, 
            date: new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            comments: [],
            reports: 0,
            views: 0
        };

        posts.unshift(newPost);
        saveLocalPosts(posts);

        showAlert('등록되었습니다.');
        window.isWriting = false; 
        resetEditor();

        localStorage.removeItem('tempPost');

        window.router(currentBoardType, isAdmin);
        document.getElementById('global-loader').classList.add('hidden'); 

    } catch (e) {
        document.getElementById('global-loader').classList.add('hidden'); 
        showAlert("오류: " + e.message);
    }
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

function reportCurrentPost() {
    if(!getDbClient() || !currentPostId) return showAlert("오프라인 상태에서는 신고할 수 없습니다.");

    const post = posts.find(p => p.id == currentPostId);
    if(post && post.type === 'notice') {
        return showAlert("공지사항은 신고할 수 없습니다.");
    }

    showConfirm("정말 이 게시글을 신고하시겠습니까?", async () => {
        if (isAdmin) {
            try {
                const { data: post } = await getDbClient().from('posts').select('reports').eq('id', currentPostId).single();
                if (post) {
                    const newCount = (post.reports || 0) + 1;
                    const { error } = await getDbClient().from('posts').update({ reports: newCount }).eq('id', currentPostId);
                    if (error) throw error;
                    showAlert("관리자 권한으로 신고 처리되었습니다.");
                    readPost(currentPostId);
                }
            } catch(e) {
                showAlert("처리 실패: " + e.message);
            }
        } else {
            const { error } = await getDbClient().rpc('report_content_secure', {
                p_type: 'post',
                p_id: currentPostId
            });

            if(error) {
                showAlert(error.message);
            } else {
                showAlert("신고가 접수되었습니다.");
                readPost(currentPostId); 
            }
        }
    }, "신고 확인", "신고하기");
}

async function togglePinPost() {
    if(!isAdmin || !currentPostId) return;
    
    const dbClient = getDbClient();
    const { data: post } = await dbClient.from('posts').select('is_pinned').eq('id', currentPostId).single();
    if(!post) return;

    const newStatus = !post.is_pinned;
    const { error } = await dbClient.from('posts').update({ is_pinned: newStatus }).eq('id', currentPostId);
    
    if(error) showAlert("고정 설정 실패");
    else {
        document.getElementById('btn-pin-post').innerHTML = newStatus ? '<i class="fa-solid fa-thumbtack"></i> 고정 해제' : '<i class="fa-solid fa-thumbtack"></i> 상단 고정';
        document.getElementById('btn-pin-post').classList.toggle('text-blue-600', newStatus);
        
        fetchPosts(currentBoardType);
    }
}

function movePostCategory(newType) {
    if(!newType || !currentPostId) return;
    
    const catName = { 'notice': '공지사항', 'free': '자유대화방', 'error': '오류해결소' }[newType];
    
    showConfirm(`이 게시글을 [${catName}]으로 이동하시겠습니까?`, async () => {
        const { error } = await getDbClient().from('posts').update({ type: newType }).eq('id', currentPostId);
        if(error) {
            showAlert("이동 실패: " + error.message);
        } else {
            showAlert("게시글이 이동되었습니다.");
            window.router('list'); 
        }
    }, "카테고리 이동", "이동");
    
    document.getElementById('move-category-select').value = "";
}
