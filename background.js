// Khởi tạo context menu khi cài đặt extension
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "translate-manga-image",
    title: "Dịch ảnh này bằng AI (Gemini)",
    contexts: ["image"]
  });
  console.log("Extension Manga Translator đã được cài đặt và tạo menu.");
});

// Lắng nghe sự kiện click vào context menu
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "translate-manga-image") {
    const imageUrl = info.srcUrl;
    if (!imageUrl) {
      sendMessageToTab(tab.id, { action: "show_error", message: "Không tìm thấy URL hình ảnh." });
      return;
    }

    // 1. Gửi tin nhắn yêu cầu khóa phần tử ảnh đang click trong content script
    chrome.tabs.sendMessage(tab.id, { action: "lock_target" }, async (response) => {
      // Bỏ qua lỗi runtime.lastError nếu có
      const err = chrome.runtime.lastError;
      
      const imageId = (response && response.success) ? response.imageId : null;
      runTranslationFlow(imageUrl, imageId, tab);
    });
  }
});

// Hàm chạy tiến trình dịch ảnh chính có định danh ảnh (imageId)
async function runTranslationFlow(imageUrl, imageId, tab) {
  // Hiển thị trạng thái đang xử lý trên trang
  sendMessageToTab(tab.id, { action: "show_loading", imageId: imageId, message: "Đang tải ảnh..." });

  try {
    let base64Data = "";
    let mimeType = "image/jpeg";

    // 1. Kiểm tra nếu URL đã là base64 data URL
    if (imageUrl.startsWith("data:")) {
      const parts = imageUrl.split(",");
      base64Data = parts[1];
      const match = parts[0].match(/data:(.*?);/);
      if (match) mimeType = match[1];
    } else {
      // 2. Tải ảnh và chuyển sang Base64
      sendMessageToTab(tab.id, { action: "show_loading", imageId: imageId, message: "Đang tải dữ liệu ảnh..." });
      
      // Nếu là blob URL, ta cần nhờ content script fetch hộ vì chạy ở cùng origin với blob
      if (imageUrl.startsWith("blob:")) {
        base64Data = await requestBase64FromContentScript(tab.id, imageUrl);
      } else {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        mimeType = blob.type || "image/jpeg";
        base64Data = await blobToBase64(blob);
      }
    }

    // 3. Lấy cấu hình API Key và Ngôn ngữ từ chrome.storage
    sendMessageToTab(tab.id, { action: "show_loading", imageId: imageId, message: "Đang dịch bằng AI..." });
    
    const config = await chrome.storage.local.get(["geminiApiKey", "targetLang", "geminiModel"]);
    const apiKey = config.geminiApiKey;
    const targetLang = config.targetLang || "Vietnamese";
    const modelName = config.geminiModel || "gemini-3.5-flash";
    const apiEndpoint = "https://generativelanguage.googleapis.com";

    if (!apiKey) {
      sendMessageToTab(tab.id, { 
        action: "show_error", 
        imageId: imageId,
        message: "Vui lòng nhấp vào biểu tượng Extension để cài đặt Gemini API Key miễn phí trước." 
      });
      return;
    }

    // 4. Gọi Gemini API
    const translationResult = await callGeminiApi(base64Data, mimeType, apiKey, targetLang, modelName, apiEndpoint);
    
    // 5. Gửi kết quả về cho content script để vẽ overlay
    sendMessageToTab(tab.id, { 
      action: "draw_overlay", 
      imageId: imageId,
      data: translationResult,
      targetLang: targetLang
    });

  } catch (error) {
    console.error("Lỗi trong quá trình dịch ảnh:", error);
    sendMessageToTab(tab.id, { action: "show_error", imageId: imageId, message: "Lỗi dịch ảnh: " + error.message });
  }
}

// Helper: Gửi tin nhắn đến Content Script một cách an toàn
function sendMessageToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message, () => {
    // Bỏ qua lỗi nếu tab không phản hồi (ví dụ tab vừa bị đóng hoặc chưa load xong)
    const err = chrome.runtime.lastError;
  });
}

// Helper: Chuyển Blob thành Base64 string
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(",")[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper: Nhờ content script tải blob URL
function requestBase64FromContentScript(tabId, blobUrl) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { action: "fetch_blob", url: blobUrl }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error("Không kết nối được với trang web để tải ảnh Blob."));
      } else if (response && response.success) {
        resolve(response.base64);
      } else {
        reject(new Error(response ? response.error : "Không thể tải ảnh Blob."));
      }
    });
  });
}

// Helper: Gọi Gemini API để dịch
async function callGeminiApi(base64Data, mimeType, apiKey, targetLang, modelName, apiEndpoint) {
  const baseEndpoint = (apiEndpoint || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
  const url = `${baseEndpoint}/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  
  const systemPrompt = `You are a Manga/Comic translation OCR assistant. Your job is to perform layout-aware OCR and translation on the provided image.
Analyze the image, detect all text blocks (especially vertical and horizontal text bubbles).
Translate the detected text into ${targetLang}.
Return ONLY a JSON array of objects representing each text box. Do not wrap in markdown code blocks. 
Each object in the JSON array must contain exactly these keys:
- "box": [ymin, xmin, ymax, xmax] (normalized coordinates from 0 to 1000, representing the bounding box where ymin is top, xmin is left, ymax is bottom, xmax is right. E.g., [120, 450, 250, 600])
- "original": the exact original text inside this text box
- "translation": the translation of this text into ${targetLang}

Make sure the coordinates are highly accurate so they can be overlayed precisely.`;

  const payload = {
    contents: [
      {
        parts: [
          { text: systemPrompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error?.message || response.statusText;
    throw new Error(`Gemini API Error: ${errorMsg}`);
  }

  const result = await response.json();
  const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textResponse) {
    throw new Error("Không nhận được phản hồi từ AI.");
  }

  try {
    return JSON.parse(textResponse.trim());
  } catch (e) {
    console.error("AI không trả về đúng định dạng JSON:", textResponse);
    throw new Error("Phản hồi của AI không đúng định dạng dữ liệu JSON.");
  }
}

// Lắng nghe các yêu cầu dịch ảnh từ Content Script gửi lên (nút hover hoặc dịch hàng loạt)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "request_translation") {
    runTranslationFlow(message.srcUrl, message.imageId, sender.tab);
  }
});
