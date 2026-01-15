// アイコンクリック時の処理
chrome.action.onClicked.addListener(async (tab) => {
  console.log('拡張機能アイコンがクリックされました', tab);

  try {
    // chrome:// や edge:// などの特殊なページでは動作しない
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      console.error('このページではキャプチャできません');
      // エラーメッセージをページに表示
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          window.alert('このページではキャプチャできません。\n通常のウェブページでお試しください。');
        }
      }).catch(() => {
        console.error('特殊ページのため、アラートも表示できません');
      });
      return;
    }

    console.log('content scriptにメッセージを送信中...');

    // まずcontent scriptが読み込まれているか確認
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'captureFullPage' });
    } catch (error) {
      // content scriptが読み込まれていない場合、手動で注入
      console.log('content scriptを手動で注入します...');

      // html2canvasを先に注入
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['libs/html2canvas.min.js']
      });

      console.log('html2canvas注入完了、content.jsを注入します');

      // 次にcontent.jsを注入
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      // 少し待ってから再試行
      await new Promise(resolve => setTimeout(resolve, 500));
      response = await chrome.tabs.sendMessage(tab.id, { action: 'captureFullPage' });
    }

    console.log('レスポンス受信:', response);

    if (response && response.success) {
      console.log('キャプチャ成功、dashboardを開きます');

      // 新しいタブでdashboardを開く
      const dashboardTab = await chrome.tabs.create({
        url: chrome.runtime.getURL('dashboard.html')
      });

      // dashboardが読み込まれるまで待機
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === dashboardTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);

          console.log('dashboardにデータを送信中...');

          // キャプチャデータをdashboardに送信
          chrome.tabs.sendMessage(dashboardTab.id, {
            action: 'displayCapture',
            imageData: response.imageData,
            pageUrl: response.pageUrl,
            pageTitle: response.pageTitle
          }).catch(err => {
            console.error('dashboardへのメッセージ送信エラー:', err);
          });
        }
      });
    } else {
      console.error('キャプチャに失敗しました:', response?.error);

      // エラーメッセージをページに表示
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (errorMsg) => {
          window.alert('ページのキャプチャに失敗しました。\n\nエラー: ' + errorMsg);
        },
        args: [response?.error || '不明なエラー']
      });
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);

    // エラーメッセージをページに表示
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (errorMsg) => {
          window.alert('エラーが発生しました:\n\n' + errorMsg + '\n\nページを再読み込みしてから、もう一度お試しください。');
        },
        args: [error.message]
      });
    } catch (e) {
      console.error('アラートの表示にも失敗しました:', e);
    }
  }
});
