// Content script読み込み完了の確認
console.log('Webpage to PDF/JPEG Converter - Content script loaded');

// メッセージリスナー
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('Content script: メッセージ受信', request);

  if (request.action === 'captureFullPage') {
    console.log('Content script: キャプチャを開始します');

    captureFullPage()
      .then(result => {
        console.log('Content script: キャプチャ成功');
        sendResponse(result);
      })
      .catch(error => {
        console.error('Content script: キャプチャエラー:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 非同期レスポンスを有効化
  }
});

// 進捗バーを表示する関数
function showProgressBar(message) {
  // 既存の進捗バーを削除
  const existingBar = document.getElementById('webpage-capture-progress');
  if (existingBar) {
    existingBar.remove();
  }

  // 進捗バーのコンテナを作成
  const progressContainer = document.createElement('div');
  progressContainer.id = 'webpage-capture-progress';
  progressContainer.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 12px;
    animation: slideDown 0.3s ease-out;
  `;

  // アニメーション用のスタイルを追加
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    .capture-spinner {
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
  `;
  document.head.appendChild(style);

  // スピナー
  const spinner = document.createElement('div');
  spinner.className = 'capture-spinner';

  // メッセージテキスト
  const text = document.createElement('span');
  text.textContent = message;

  progressContainer.appendChild(spinner);
  progressContainer.appendChild(text);
  document.body.appendChild(progressContainer);

  return progressContainer;
}

// 進捗バーを更新する関数
function updateProgressBar(message) {
  const progressBar = document.getElementById('webpage-capture-progress');
  if (progressBar) {
    const textElement = progressBar.querySelector('span');
    if (textElement) {
      textElement.textContent = message;
    }
  }
}

// 進捗バーを非表示にする関数
function hideProgressBar() {
  const progressBar = document.getElementById('webpage-capture-progress');
  if (progressBar) {
    progressBar.style.animation = 'slideDown 0.3s ease-out reverse';
    setTimeout(() => {
      progressBar.remove();
    }, 300);
  }
}

// ページ全体をキャプチャする関数
async function captureFullPage() {
  let progressBar = null;

  try {
    console.log('キャプチャを開始します...');

    // 進捗バーを表示
    progressBar = showProgressBar('📸 キャプチャを準備中...');

    // html2canvasが利用可能か確認
    if (typeof html2canvas === 'undefined') {
      console.error('html2canvas がグローバルスコープに存在しません');
      hideProgressBar();
      throw new Error('html2canvas ライブラリが読み込まれていません。ページを再読み込みしてください。');
    }

    console.log('html2canvas が利用可能です');

    // 現在のスクロール位置を保存
    const originalScrollX = window.scrollX;
    const originalScrollY = window.scrollY;

    updateProgressBar('📜 ページを最上部にスクロール中...');

    // ページの最上部にスクロール
    window.scrollTo(0, 0);

    // ページ全体のスクロール高さを取得
    const scrollHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );

    const scrollWidth = Math.max(
      document.body.scrollWidth,
      document.body.offsetWidth,
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth,
      document.documentElement.offsetWidth
    );

    console.log(`ページサイズ: ${scrollWidth} x ${scrollHeight}`);

    updateProgressBar('⏳ レイアウトを安定化中...');

    // スクロール後、少し待機してレイアウトが安定するのを待つ
    await new Promise(resolve => setTimeout(resolve, 300));

    updateProgressBar('📸 ページ全体をキャプチャ中...');
    console.log('html2canvasでキャプチャ中（ページ全体）...');

    // html2canvasでキャプチャ（ページ全体を最上部から）
    const canvas = await html2canvas(document.documentElement, {
      allowTaint: true,
      useCORS: true,
      scrollY: 0,
      scrollX: 0,
      windowHeight: scrollHeight,
      height: scrollHeight,
      width: document.body.scrollWidth,
      imageTimeout: 0,
      logging: false,
      // 進捗バーを無視
      ignoreElements: function(element) {
        if (element.id === 'webpage-capture-progress') {
          return true;
        }
        return false;
      }
    });

    console.log('キャプチャ完了、画像データに変換中...');

    updateProgressBar('🖼️ 画像データに変換中...');

    // 元のスクロール位置に戻す
    window.scrollTo(originalScrollX, originalScrollY);

    // canvasをBase64エンコードされた画像データに変換
    const imageData = canvas.toDataURL('image/png');

    console.log(`画像データサイズ: ${(imageData.length / 1024 / 1024).toFixed(2)} MB`);

    updateProgressBar('✅ キャプチャ完了！');

    // 少し表示してから非表示
    await new Promise(resolve => setTimeout(resolve, 500));
    hideProgressBar();

    return {
      success: true,
      imageData: imageData,
      pageUrl: window.location.href,
      pageTitle: document.title
    };
  } catch (error) {
    console.error('captureFullPage内でエラー:', error);
    hideProgressBar();
    throw new Error(`キャプチャに失敗しました: ${error.message}`);
  }
}
