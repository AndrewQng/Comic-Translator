document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("apiKey");
  const targetLanguageSelect = document.getElementById("targetLanguage");
  const geminiModelSelect = document.getElementById("geminiModel");
  const fontSizeMultiplierInput = document.getElementById("fontSizeMultiplier");
  const fontSizeValEl = document.getElementById("fontSizeVal");
  const fontFamilySelect = document.getElementById("fontFamily");
  const saveBtn = document.getElementById("saveBtn");
  const togglePasswordBtn = document.getElementById("togglePassword");
  const statusEl = document.getElementById("status");

  // 1. Tải cấu hình đã lưu
  chrome.storage.local.get(["geminiApiKey", "targetLang", "geminiModel", "fontSizeMultiplier", "fontFamily"], (result) => {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }
    if (result.targetLang) {
      targetLanguageSelect.value = result.targetLang;
    }
    if (result.geminiModel) {
      geminiModelSelect.value = result.geminiModel;
    }
    if (result.fontSizeMultiplier) {
      fontSizeMultiplierInput.value = result.fontSizeMultiplier;
      fontSizeValEl.textContent = parseFloat(result.fontSizeMultiplier).toFixed(1) + "x";
    }
    if (result.fontFamily) {
      fontFamilySelect.value = result.fontFamily;
    }
  });

  // 2. Ẩn/Hiện API Key
  togglePasswordBtn.addEventListener("click", () => {
    const isPassword = apiKeyInput.type === "password";
    apiKeyInput.type = isPassword ? "text" : "password";
    
    const eyeIcon = togglePasswordBtn.querySelector("svg");
    if (isPassword) {
      // Đổi sang icon "gạch mắt"
      eyeIcon.innerHTML = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      `;
    } else {
      // Đổi lại sang icon "mắt thường"
      eyeIcon.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      `;
    }
  });

  // Tự động lưu & áp dụng tức thời khi người dùng trượt cỡ chữ hoặc chọn kiểu chữ
  fontSizeMultiplierInput.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value).toFixed(1);
    fontSizeValEl.textContent = val + "x";
    chrome.storage.local.set({ fontSizeMultiplier: val });
  });

  fontFamilySelect.addEventListener("change", (e) => {
    chrome.storage.local.set({ fontFamily: e.target.value });
  });

  // 3. Lưu cấu hình khi click Lưu Cài Đặt (bao gồm cả model và key)
  saveBtn.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    const targetLang = targetLanguageSelect.value;
    const geminiModel = geminiModelSelect.value;
    const fontSizeMultiplier = fontSizeMultiplierInput.value;
    const fontFamily = fontFamilySelect.value;

    chrome.storage.local.set(
      {
        geminiApiKey: apiKey,
        targetLang: targetLang,
        geminiModel: geminiModel,
        fontSizeMultiplier: fontSizeMultiplier,
        fontFamily: fontFamily
      },
      () => {
        // Hiệu ứng hiển thị thông báo đã lưu thành công
        statusEl.textContent = "Cài đặt đã được lưu!";
        statusEl.classList.add("show");
        
        // Vô hiệu hóa nút tạm thời
        saveBtn.style.pointerEvents = "none";
        saveBtn.style.opacity = "0.8";

        setTimeout(() => {
          statusEl.classList.remove("show");
          saveBtn.style.pointerEvents = "auto";
          saveBtn.style.opacity = "1";
        }, 2000);
      }
    );
  });

  // 4. Bật chế độ chọn nhiều ảnh dịch
  const selectMultipleBtn = document.getElementById("selectMultipleBtn");
  selectMultipleBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "start_selection_mode" }, () => {
          const err = chrome.runtime.lastError;
          window.close(); // Đóng popup để người dùng bắt đầu chọn ảnh trên trang
        });
      }
    });
  });
});
