// グローバル変数
let originalImageData = null;
let currentPageUrl = '';
let currentPageTitle = '';
let previewCanvas = null;
let previewCtx = null;

// DOM要素
const includeUrlToggle = document.getElementById('includeUrlToggle');
const copyImageBtn = document.getElementById('copyImageBtn');
const saveJpegBtn = document.getElementById('saveJpegBtn');
const savePdfBtn = document.getElementById('savePdfBtn');
const saveBothBtn = document.getElementById('saveBothBtn');
const loadingMessage = document.getElementById('loadingMessage');
const urlInfo = document.getElementById('urlInfo');
const statusMessage = document.getElementById('statusMessage');

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  previewCanvas = document.getElementById('previewCanvas');
  previewCtx = previewCanvas.getContext('2d');

  // イベントリスナーの設定
  includeUrlToggle.addEventListener('change', updatePreview);
  copyImageBtn.addEventListener('click', () => copyToClipboard());
  saveJpegBtn.addEventListener('click', () => saveAsJpeg());
  savePdfBtn.addEventListener('click', () => saveAsPdf());
  saveBothBtn.addEventListener('click', () => saveBoth());
});

// メッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'displayCapture') {
    originalImageData = request.imageData;
    currentPageUrl = request.pageUrl;
    currentPageTitle = request.pageTitle;

    // URL情報を表示
    urlInfo.textContent = `キャプチャ元: ${currentPageUrl}`;
    urlInfo.style.display = 'block';

    // プレビューを更新
    updatePreview();

    // ボタンを有効化
    copyImageBtn.disabled = false;
    saveJpegBtn.disabled = false;
    savePdfBtn.disabled = false;
    saveBothBtn.disabled = false;
  }
});

// プレビューを更新する関数
async function updatePreview() {
  if (!originalImageData) return;

  showStatus('プレビューを更新中...', 'info');

  try {
    const img = new Image();
    img.onload = () => {
      const includeUrl = includeUrlToggle.checked;
      const headerHeight = includeUrl ? 60 : 0;

      // canvasのサイズを設定
      previewCanvas.width = img.width;
      previewCanvas.height = img.height + headerHeight;

      // 背景を白で塗りつぶし
      previewCtx.fillStyle = 'white';
      previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

      // URLヘッダーを追加
      if (includeUrl) {
        drawUrlHeader(previewCtx, currentPageUrl, img.width, headerHeight);
      }

      // 元の画像を描画
      previewCtx.drawImage(img, 0, headerHeight);

      // プレビューを表示
      loadingMessage.style.display = 'none';
      previewCanvas.style.display = 'block';

      hideStatus();
    };

    img.onerror = () => {
      showStatus('画像の読み込みに失敗しました', 'error');
    };

    img.src = originalImageData;
  } catch (error) {
    console.error('プレビュー更新エラー:', error);
    showStatus('プレビューの更新に失敗しました', 'error');
  }
}

// URLヘッダーを描画する関数
function drawUrlHeader(ctx, url, width, height) {
  // 背景（白）
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);

  // 枠線
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, width, height);

  // テキスト（黒）
  ctx.fillStyle = 'black';
  ctx.font = '14px Arial, sans-serif';
  ctx.textBaseline = 'top';

  // URLテキストを描画（長い場合は省略）
  const padding = 10;
  const maxWidth = width - padding * 2;
  const text = `URL: ${url}`;

  // テキストが長すぎる場合は省略
  let displayText = text;
  const textWidth = ctx.measureText(text).width;

  if (textWidth > maxWidth) {
    // テキストを切り詰める
    const ellipsis = '...';
    let truncated = text;
    while (ctx.measureText(truncated + ellipsis).width > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    displayText = truncated + ellipsis;
  }

  ctx.fillText(displayText, padding, padding);

  // タイムスタンプを追加
  const timestamp = new Date().toLocaleString('ja-JP');
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText(`キャプチャ日時: ${timestamp}`, padding, padding + 25);
}

// クリップボードにコピー
async function copyToClipboard() {
  if (!previewCanvas) return;

  showStatus('画像をクリップボードにコピー中...', 'info');

  try {
    // canvasをBlobに変換
    const blob = await new Promise(resolve => {
      previewCanvas.toBlob(resolve, 'image/png');
    });

    // Clipboard APIを使用してコピー
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob
      })
    ]);

    showStatus('画像をクリップボードにコピーしました！', 'success');
    hideStatus();
  } catch (error) {
    console.error('クリップボードコピーエラー:', error);
    showStatus('クリップボードへのコピーに失敗しました', 'error');
  }
}

// JPEGとして保存
async function saveAsJpeg() {
  if (!previewCanvas) return;

  showStatus('JPEGファイルを生成中...', 'info');

  try {
    const blob = await new Promise(resolve => {
      previewCanvas.toBlob(resolve, 'image/jpeg', 0.95);
    });

    const filename = generateFilename('jpg');
    await downloadBlob(blob, filename);

    showStatus('JPEGファイルを保存しました', 'success');
  } catch (error) {
    console.error('JPEG保存エラー:', error);
    showStatus('JPEGの保存に失敗しました', 'error');
  }
}

// PDFとして保存
async function saveAsPdf() {
  if (!previewCanvas) return;

  showStatus('PDFファイルを生成中...', 'info');

  try {
    const { jsPDF } = window.jspdf;

    // canvasのサイズを取得
    const imgWidth = previewCanvas.width;
    const imgHeight = previewCanvas.height;

    // A4サイズに合わせて計算（210mm x 297mm）
    const pdfWidth = 210;
    const pdfHeight = (imgHeight * pdfWidth) / imgWidth;

    // PDFを作成
    const pdf = new jsPDF({
      orientation: pdfHeight > 297 ? 'portrait' : 'portrait',
      unit: 'mm',
      format: [pdfWidth, pdfHeight]
    });

    // canvasをPDFに追加
    const imgData = previewCanvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

    // PDFをBlobとして取得
    const pdfBlob = pdf.output('blob');
    const filename = generateFilename('pdf');
    await downloadBlob(pdfBlob, filename);

    showStatus('PDFファイルを保存しました', 'success');
  } catch (error) {
    console.error('PDF保存エラー:', error);
    showStatus('PDFの保存に失敗しました', 'error');
  }
}

// 両方の形式で保存
async function saveBoth() {
  showStatus('両方の形式で保存中...', 'info');

  try {
    await saveAsJpeg();
    await new Promise(resolve => setTimeout(resolve, 500)); // 少し待機
    await saveAsPdf();
    showStatus('両方のファイルを保存しました', 'success');
  } catch (error) {
    console.error('保存エラー:', error);
    showStatus('保存中にエラーが発生しました', 'error');
  }
}

// ファイル名を生成
function generateFilename(extension) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);

  // ページタイトルをファイル名に使用（無効な文字を除去）
  let safeName = currentPageTitle
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);

  if (!safeName) {
    safeName = 'webpage';
  }

  return `${safeName}_${timestamp}.${extension}`;
}

// Blobをダウンロード
async function downloadBlob(blob, filename) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        // ダウンロード完了後にURLを解放
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve(downloadId);
      }
    });
  });
}

// ステータスメッセージを表示
function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = 'status-message';

  if (type === 'success' || type === 'error') {
    statusMessage.classList.add(type);
  }
}

// ステータスメッセージを非表示
function hideStatus() {
  setTimeout(() => {
    statusMessage.style.display = 'none';
    statusMessage.className = 'status-message';
  }, 3000);
}
