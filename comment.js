
async function submitComment() {
    if(isSubmitting) return; 
    isSubmitting = true;

    const dbClient = getDbClient();
    let name = document.getElementById('cmtName').value.trim();
    let contentText = document.getElementById('cmtContent').value; 
    let pw = document.getElementById('cmtPw').value.trim();

    if(!contentText.trim() && currentCommentImages.length === 0) {
        isSubmitting = false;
        return showAlert("내용을 입력하세요.");
    }

    if (!isAdmin && typeof grecaptcha !== 'undefined' && RECAPTCHA_SITE_KEY) {
        try {
            const token = await new Promise((resolve) => {
                grecaptcha.ready(() => {
                    grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit_comment' })
                        .then(token => resolve(token))
                        .catch(err => { console.error(err); resolve(null); });
                });
            });

            if (!token) {
                isSubmitting = false;
                return showAlert("캡차 토큰 생성에 실패했습니다.");
            }

            const isVerified = await verifyCaptcha(token);
            if (!isVerified) {
                isSubmitting = false;
                return showAlert(
                    "보안 검증(봇 탐지)에 실패했습니다.\n\n" +
                    "1. 현재 '시크릿 모드'를 사용 중이라면 해제해주세요.\n" +
                    "2. VPN이나 광고 차단 확장 프로그램을 끄고 시도해주세요.\n\n"
                );
            }
        } catch (e) {
            console.error("Captcha error:", e);
            isSubmitting = false;
            return showAlert("캡차 인증 중 오류가 발생했습니다.");
        }
    }

    if (isBanned) {
        isSubmitting = false;
        return showAlert("차단된 사용자는 댓글을 쓸 수 없습니다.");
    }

    let imageHtml = '';
    if(currentCommentImages.length > 0) {
        imageHtml = '<div class="comment-img-container">';
        currentCommentImages.forEach(src => { imageHtml += `<img src="${src}" class="comment-img-thumb" onclick="openLightbox(this.src)">`; });
        imageHtml += '</div>';
    }
    
    let parentTag = replyingToCommentId ? `<!-- parent_id:${replyingToCommentId} -->` : '';
    
    let safeText = contentText.replace(/&/g, "&amp;")
                              .replace(/</g, "&lt;")
                              .replace(/>/g, "&gt;")
                              .replace(/"/g, "&quot;")
                              .replace(/'/g, "&#039;");

    safeText = safeText.replace(/(https?:\/\/[^\s]+)/g, function(url) {
        return `<a href="javascript:void(0)" onclick="event.preventDefault(); window.confirmLink('${url}'); return false;" class="text-blue-600 hover:underline" title="${url}">${url}</a>`;
    });

    let finalContent = safeText.replace(/\n/g, '<br>') + imageHtml + parentTag;

    if(!isAdmin) saveNickname(name);

    if(editingCommentId && dbClient) {
        const { error } = await dbClient.from('comments').update({ content: finalContent }).eq('id', editingCommentId);
        if(error) {
            isSubmitting = false;
            showAlert("수정 실패");
        } else {
            const post = posts.find(p => p.id == currentPostId);
            const cmtIndex = post.comments.findIndex(c => c.id == editingCommentId);
            if(cmtIndex !== -1) post.comments[cmtIndex].content = finalContent;
            renderComments(post.comments, 'comment-list', isAdmin);
            cancelCommentEdit();
            isSubmitting = false;
        }
        return;
    }

    if(isAdmin) { name = "하포카"; pw = ""; }
    else {
        if(!name) { isSubmitting = false; return showAlert("닉네임 입력"); }
        if(!pw) { isSubmitting = false; return showAlert("비번 입력"); }
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
        
        await readPost(currentPostId);
        
        document.getElementById('cmtContent').value = '';
        document.getElementById('cmtPw').value = '';
        currentCommentImages = [];
        renderCommentImagePreview();
        cancelReply(); 
    } catch (e) { showAlert("실패: " + e.message); } 
    finally { 
        document.getElementById('global-loader').classList.add('hidden'); 
        isSubmitting = false;
    }
}

window.replyToComment = (id, author) => {
    replyingToCommentId = id;
    document.getElementById('reply-target-msg').innerText = author;
    document.getElementById('reply-target-box').classList.remove('hidden');
    document.getElementById('cmtContent').focus();
    document.getElementById('cmt-drop-zone').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.reportComment = async (id) => {
    const dbClient = getDbClient();
    if(!dbClient) return showAlert("오프라인 불가");
    
    showConfirm("신고하시겠습니까?", async () => {
        if (isAdmin) {
            try {
                const { data: cmt } = await dbClient.from('comments').select('reports').eq('id', id).single();
                if (cmt) {
                    const newCount = (cmt.reports || 0) + 1;
                    const { error } = await dbClient.from('comments').update({ reports: newCount }).eq('id', id);
                    if (error) throw error;
                    showAlert("관리자 권한으로 신고 처리되었습니다.");
                    
                    const post = posts.find(p => p.id == currentPostId);
                    if(post && post.comments) {
                        const target = post.comments.find(c => c.id == id);
                        if(target) target.reports = newCount;
                        renderComments(post.comments, 'comment-list', isAdmin);
                    }
                }
            } catch(e) {
                showAlert("처리 실패: " + e.message);
            }
        } else {
            const { error } = await dbClient.rpc('report_content_secure', { p_type: 'comment', p_id: id });
            if(error) showAlert(error.message); 
            else {
                showAlert("신고 접수됨");
                const post = posts.find(p => p.id == currentPostId);
                if(post && post.comments) {
                    const target = post.comments.find(c => c.id == id);
                    if(target) target.reports = (target.reports || 0) + 1;
                    renderComments(post.comments, 'comment-list', isAdmin);
                }
            }
        }
    }, "신고", "신고");
};

window.removeCommentImage = (idx) => {
    currentCommentImages.splice(idx, 1);
    renderCommentImagePreview();
};

window.cancelCommentEdit = function() {
    editingCommentId = null;
    cancelReply(); 
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

window.cancelReply = function() {
    replyingToCommentId = null;
    document.getElementById('reply-target-box').classList.add('hidden');
}

window.uploadCommentImage = (input) => {
    if(input.files && input.files.length > 0) {
        currentCommentImages = []; 
        processCommentImages(input.files, currentCommentImages, renderCommentImagePreview);
        input.value = '';
    }
};

function loadCommentForEdit(cmt) {
    cancelReply();
    editingCommentId = cmt.id;
    
    const match = cmt.content.match(/<!-- parent_id:(.*?) -->/);
    if (match && match[1]) {
        replyingToCommentId = match[1];
    }

    document.getElementById('cmtName').value = cmt.author;
    document.getElementById('cmtName').disabled = true;
    document.getElementById('cmtPw').classList.add('hidden'); 
    let tempDiv = document.createElement('div');
    tempDiv.innerHTML = cmt.content;
    
    const uniqueImages = new Set();
    
    const container = tempDiv.querySelector('.comment-img-container');
    if (container) {
        container.querySelectorAll('img').forEach(img => {
            if (!uniqueImages.has(img.src)) {
                uniqueImages.add(img.src);
            }
        });
    } else {
        tempDiv.querySelectorAll('img').forEach(img => {
            if (!uniqueImages.has(img.src)) {
                uniqueImages.add(img.src);
            }
        });
    }
    currentCommentImages = Array.from(uniqueImages);

    tempDiv.querySelectorAll('.comment-img-container').forEach(el => el.remove());
    tempDiv.querySelectorAll('img').forEach(img => img.remove());
    
    let htmlContent = tempDiv.innerHTML.replace(/<!-- parent_id:.*? -->/g, '');
    tempDiv.innerHTML = htmlContent;
    let textOnly = tempDiv.innerHTML.replace(/<br\s*\/?>/gi, "\n").trim();
    textOnly = textOnly.replace(/<[^>]*>/g, ''); 

    var txt = document.createElement("textarea");
    txt.innerHTML = textOnly;
    textOnly = txt.value;

    document.getElementById('cmtContent').value = textOnly;
    document.getElementById('btn-submit-cmt').innerText = "수정완료";
    document.getElementById('btn-cmt-cancel').classList.remove('hidden');
    renderCommentImagePreview();
}

async function deleteComment(id) {
    const dbClient = getDbClient();
    if(dbClient) {
        const { error } = await dbClient.from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', id);
        if(error) showAlert("삭제 실패");
        else {
            showAlert("삭제되었습니다.");
            readPost(currentPostId);
        }
    }
}
