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

// ページ全体をキャプチャする関数
async function captureFullPage() {
  try {
    console.log('キャプチャを開始します...');

    // html2canvasが利用可能か確認
    if (typeof html2canvas === 'undefined') {
      console.error('html2canvas がグローバルスコープに存在しません');
      throw new Error('html2canvas ライブラリが読み込まれていません。ページを再読み込みしてください。');
    }

    console.log('html2canvas が利用可能です');

    // ページ全体のスクロール高さを取得
    const scrollHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );

    console.log(`ページサイズ: ${document.body.scrollWidth} x ${scrollHeight}`);

    // 現在のスクロール位置を保存
    const originalScrollY = window.scrollY;

    console.log('html2canvasでキャプチャ中...');

    // html2canvasでキャプチャ
    const canvas = await html2canvas(document.body, {
      allowTaint: true,
      useCORS: true,
      scrollY: -window.scrollY,
      scrollX: -window.scrollX,
      windowHeight: scrollHeight,
      height: scrollHeight,
      width: document.body.scrollWidth,
      imageTimeout: 0,
      logging: false
    });

    console.log('キャプチャ完了、画像データに変換中...');

    // 元のスクロール位置に戻す
    window.scrollTo(0, originalScrollY);

    // canvasをBase64エンコードされた画像データに変換
    const imageData = canvas.toDataURL('image/png');

    console.log(`画像データサイズ: ${(imageData.length / 1024 / 1024).toFixed(2)} MB`);

    return {
      success: true,
      imageData: imageData,
      pageUrl: window.location.href,
      pageTitle: document.title
    };
  } catch (error) {
    console.error('captureFullPage内でエラー:', error);
    throw new Error(`キャプチャに失敗しました: ${error.message}`);
  }
}
