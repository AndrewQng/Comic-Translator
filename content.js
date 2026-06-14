// Theo dõi phần tử cuối cùng được click chuột phải
let lastRightClickedElement = null;

document.addEventListener("contextmenu", (e) => {
  lastRightClickedElement = e.target;
});

// Cấu hình Font mặc định và biến lưu trữ tạm thời trong tab
let currentFontSizeMultiplier = 1.0;
let currentFontFamily = "'Comic Sans MS', 'Chalkboard SE', -apple-system, sans-serif";

// Tải cấu hình font từ storage
chrome.storage.local.get(["fontSizeMultiplier", "fontFamily"], (result) => {
  if (result.fontSizeMultiplier) {
    const val = parseFloat(result.fontSizeMultiplier);
    if (!isNaN(val)) currentFontSizeMultiplier = val;
  }
  if (result.fontFamily) {
    currentFontFamily = result.fontFamily;
  }
});

// Lắng nghe sự thay đổi cấu hình font từ popup để áp dụng tức thời
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    let changed = false;
    if (changes.fontSizeMultiplier && changes.fontSizeMultiplier.newValue !== undefined) {
      const val = parseFloat(changes.fontSizeMultiplier.newValue);
      if (!isNaN(val)) {
        currentFontSizeMultiplier = val;
        changed = true;
      }
    }
    if (changes.fontFamily && changes.fontFamily.newValue !== undefined) {
      currentFontFamily = changes.fontFamily.newValue;
      changed = true;
    }
    if (changed) {
      updateAllExistingOverlaysFont();
    }
  }
});

// Hàm cập nhật font cho tất cả các bản dịch hiện có trên trang
function updateAllExistingOverlaysFont() {
  activeOverlays.forEach((state, img) => {
    if (!img.isConnected) {
      removeOverlayForImage(img);
      return;
    }
    if (state.updatePosition) {
      state.updatePosition();
    }
  });
}

// Lắng nghe tin nhắn từ background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "start_selection_mode") {
    enterSelectionMode();
    sendResponse({ success: true });
    return true;
  }

  if (message.action === "lock_target") {
    const targetImg = getTargetImage();
    if (targetImg) {
      if (!targetImg.dataset.mangaImageId) {
        targetImg.dataset.mangaImageId = "manga-img-" + Math.random().toString(36).substr(2, 9);
      }
      sendResponse({ success: true, imageId: targetImg.dataset.mangaImageId });
    } else {
      sendResponse({ success: false, error: "Không tìm thấy ảnh được click." });
    }
    return true;
  }

  if (message.action === "fetch_blob") {
    // Xử lý tải ảnh Blob
    fetch(message.url)
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          sendResponse({ success: true, base64: reader.result.split(",")[1] });
        };
        reader.onerror = (err) => {
          sendResponse({ success: false, error: err.message });
        };
        reader.readAsDataURL(blob);
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    return true; // Giữ kết nối để phản hồi bất đồng bộ
  }

  // Khởi động tiến trình dịch ảnh (từ background khi click menu)
  if (message.action === "show_loading") {
    handleShowLoading(message.message, message.imageId);
  } else if (message.action === "show_error") {
    handleShowError(message.message, message.imageId);
  } else if (message.action === "draw_overlay") {
    handleDrawOverlay(message.data, message.targetLang, message.imageId);
  }
});

// Tìm phần tử hình ảnh mục tiêu (hoặc bằng imageId hoặc bằng phần tử click cuối cùng)
function getTargetImage(imageId) {
  if (imageId) {
    const found = document.querySelector(`[data-manga-image-id="${imageId}"]`);
    if (found) return found;
  }
  
  if (lastRightClickedElement && (lastRightClickedElement.tagName === "IMG" || lastRightClickedElement.tagName === "IMAGE")) {
    return lastRightClickedElement;
  }
  
  return lastRightClickedElement;
}

// Lưu trữ các trạng thái overlay và observer để dọn dẹp
const activeOverlays = new Map(); // targetImage -> { overlayContainer, observer, toastIndicator }

// Hiển thị loading overlay đè lên toàn bộ ảnh
function handleShowLoading(statusMessage, imageId) {
  const targetImg = getTargetImage(imageId);
  if (!targetImg) return;

  removeLoadingOrError(targetImg);

  // Tạo overlay che phủ toàn bộ ảnh
  const loadingOverlay = document.createElement("div");
  loadingOverlay.className = "manga-translator-loading-overlay";
  document.body.appendChild(loadingOverlay);

  const loaderContent = document.createElement("div");
  loaderContent.className = "manga-loading-content";

  const spinner = document.createElement("div");
  spinner.className = "manga-loading-spinner";

  const text = document.createElement("span");
  text.className = "manga-loading-text";
  text.textContent = statusMessage;

  loaderContent.appendChild(spinner);
  loaderContent.appendChild(text);
  loadingOverlay.appendChild(loaderContent);

  // Vị trí khớp chính xác với ảnh
  const updatePos = () => {
    if (!targetImg || !loadingOverlay) return;
    const rect = targetImg.getBoundingClientRect();
    loadingOverlay.style.top = `${rect.top + window.scrollY}px`;
    loadingOverlay.style.left = `${rect.left + window.scrollX}px`;
    loadingOverlay.style.width = `${rect.width}px`;
    loadingOverlay.style.height = `${rect.height}px`;
  };
  
  updatePos();
  
  // Theo dõi kích thước bằng ResizeObserver
  const resizeObserver = new ResizeObserver(() => updatePos());
  resizeObserver.observe(targetImg);

  // Lắng nghe cuộn trang và đổi kích thước cửa sổ
  window.addEventListener("scroll", updatePos, { passive: true });
  window.addEventListener("resize", updatePos, { passive: true });

  // Lưu tham chiếu để dọn dẹp
  if (!activeOverlays.has(targetImg)) {
    activeOverlays.set(targetImg, {});
  }
  activeOverlays.get(targetImg).loadingOverlay = loadingOverlay;
  activeOverlays.get(targetImg).loadingObserver = resizeObserver;
  
  // Lưu hàm dọn dẹp trực tiếp trên phần tử DOM
  loadingOverlay.cleanup = () => {
    window.removeEventListener("scroll", updatePos);
    window.removeEventListener("resize", updatePos);
  };
}

// Hiển thị lỗi
function handleShowError(errorMessage, imageId) {
  const targetImg = getTargetImage(imageId);
  if (!targetImg) {
    alert(errorMessage);
    return;
  }

  removeLoadingOrError(targetImg);

  // Tạo overlay báo lỗi mờ đè lên ảnh
  const errorOverlay = document.createElement("div");
  errorOverlay.className = "manga-translator-loading-overlay";
  document.body.appendChild(errorOverlay);

  const loaderContent = document.createElement("div");
  loaderContent.className = "manga-loading-content";
  loaderContent.style.borderLeft = "4px solid #ef4444";

  const text = document.createElement("span");
  text.className = "manga-loading-text";
  text.style.color = "#ef4444";
  text.textContent = errorMessage;

  const closeBtn = document.createElement("button");
  closeBtn.className = "manga-overlay-close-btn";
  closeBtn.innerHTML = "&times;";
  closeBtn.style.position = "static";
  closeBtn.style.marginTop = "8px";
  closeBtn.addEventListener("click", () => {
    errorOverlay.remove();
  });

  loaderContent.appendChild(text);
  loaderContent.appendChild(closeBtn);
  errorOverlay.appendChild(loaderContent);

  const updatePos = () => {
    if (!targetImg || !errorOverlay) return;
    const rect = targetImg.getBoundingClientRect();
    errorOverlay.style.top = `${rect.top + window.scrollY}px`;
    errorOverlay.style.left = `${rect.left + window.scrollX}px`;
    errorOverlay.style.width = `${rect.width}px`;
    errorOverlay.style.height = `${rect.height}px`;
  };
  
  updatePos();
  
  const resizeObserver = new ResizeObserver(() => updatePos());
  resizeObserver.observe(targetImg);

  window.addEventListener("scroll", updatePos, { passive: true });
  window.addEventListener("resize", updatePos, { passive: true });

  if (!activeOverlays.has(targetImg)) {
    activeOverlays.set(targetImg, {});
  }
  activeOverlays.get(targetImg).loadingOverlay = errorOverlay;
  activeOverlays.get(targetImg).loadingObserver = resizeObserver;
  
  errorOverlay.cleanup = () => {
    window.removeEventListener("scroll", updatePos);
    window.removeEventListener("resize", updatePos);
  };
}

// Xóa Loading/Error overlay
function removeLoadingOrError(img) {
  const state = activeOverlays.get(img);
  if (state) {
    if (state.loadingOverlay) {
      if (state.loadingOverlay.cleanup) {
        try { state.loadingOverlay.cleanup(); } catch(e) {}
      }
      state.loadingOverlay.remove();
      state.loadingOverlay = null;
    }
    if (state.loadingObserver) {
      try { state.loadingObserver.disconnect(); } catch(e) {}
      state.loadingObserver = null;
    }
  }
}

// Vẽ Overlay kết quả dịch
function handleDrawOverlay(boxes, targetLang, imageId) {
  const targetImg = getTargetImage(imageId);
  if (!targetImg) return;

  // 1. Dọn dẹp loading toast
  removeLoadingOrError(targetImg);

  // 2. Nếu đã có overlay cũ cho ảnh này, xóa đi
  removeOverlayForImage(targetImg);

  // 3. Tạo overlay container mới
  const overlayContainer = document.createElement("div");
  overlayContainer.className = "manga-translator-overlay-container";
  document.body.appendChild(overlayContainer);

  // Nút đóng overlay
  const closeBtn = document.createElement("div");
  closeBtn.className = "manga-overlay-close-btn";
  closeBtn.innerHTML = "&times;";
  closeBtn.title = "Đóng bản dịch";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeOverlayForImage(targetImg);
  });
  overlayContainer.appendChild(closeBtn);

  // Lưu kích thước hiện tại của ảnh
  let imgWidth = targetImg.clientWidth;
  let imgHeight = targetImg.clientHeight;

  // 4. Vẽ các hộp dịch
  boxes.forEach(boxData => {
    const box = boxData.box; // [ymin, xmin, ymax, xmax]
    if (!box || box.length !== 4) return;

    const ymin = box[0];
    const xmin = box[1];
    const ymax = box[2];
    const xmax = box[3];

    // Tạo hộp dịch vị trí tương đối (%)
    const topPercent = ymin / 10;
    const leftPercent = xmin / 10;
    const widthPercent = (xmax - xmin) / 10;
    const heightPercent = (ymax - ymin) / 10;

    const tBox = document.createElement("div");
    tBox.className = "manga-translation-box";
    tBox.style.top = `${topPercent}%`;
    tBox.style.left = `${leftPercent}%`;
    tBox.style.width = `${widthPercent}%`;
    tBox.style.height = `${heightPercent}%`;
    
    // Tạo bong bóng thực tế bên trong khung ngoài
    const tBubble = document.createElement("div");
    tBubble.className = "manga-translation-bubble";
    tBubble.title = `Gốc: ${boxData.original}`;

    const tText = document.createElement("div");
    tText.className = "manga-translation-text";
    tText.textContent = boxData.translation;

    tBubble.appendChild(tText);
    tBox.appendChild(tBubble);
    overlayContainer.appendChild(tBox);

    // Tính toán kích thước chữ và tự động co bong bóng lại vừa vặn nhất
    adjustFontSize(tBox, tText, imgWidth, imgHeight, widthPercent, heightPercent, boxData.translation.length);
  });

  // 5. Cập nhật vị trí của overlay container khớp tuyệt đối với thẻ img
  const updatePosition = () => {
    if (!targetImg || !overlayContainer) return;
    const rect = targetImg.getBoundingClientRect();
    
    overlayContainer.style.top = `${rect.top + window.scrollY}px`;
    overlayContainer.style.left = `${rect.left + window.scrollX}px`;
    overlayContainer.style.width = `${rect.width}px`;
    overlayContainer.style.height = `${rect.height}px`;
    
    // Cập nhật lại font-size khi kích thước ảnh thay đổi
    const boxesElements = overlayContainer.querySelectorAll(".manga-translation-box");
    boxesElements.forEach((el, index) => {
      const boxData = boxes[index];
      if (!boxData) return;
      
      const widthPercent = (boxData.box[3] - boxData.box[1]) / 10;
      const heightPercent = (boxData.box[2] - boxData.box[0]) / 10;
      const textEl = el.querySelector(".manga-translation-text");
      
      adjustFontSize(el, textEl, rect.width, rect.height, widthPercent, heightPercent, boxData.translation.length);
    });
  };

  // Cập nhật vị trí ban đầu
  updatePosition();

  // 6. Theo dõi sự thay đổi kích thước của ảnh bằng ResizeObserver để di chuyển overlay tương ứng
  const resizeObserver = new ResizeObserver(() => {
    updatePosition();
  });
  resizeObserver.observe(targetImg);

  // Lắng nghe cuộn trang và đổi kích thước cửa sổ để giữ overlay chuẩn
  window.addEventListener("scroll", updatePosition, { passive: true });
  window.addEventListener("resize", updatePosition, { passive: true });

  // Lưu trữ để dọn dẹp và cập nhật font
  activeOverlays.set(targetImg, {
    overlayContainer: overlayContainer,
    observer: resizeObserver,
    eventListeners: {
      scroll: updatePosition,
      resize: updatePosition
    },
    updatePosition: updatePosition
  });
}

// Xóa overlay của ảnh cụ thể
function removeOverlayForImage(img) {
  const state = activeOverlays.get(img);
  if (state) {
    if (state.overlayContainer) {
      state.overlayContainer.remove();
    }
    if (state.observer) {
      state.observer.disconnect();
    }
    if (state.eventListeners) {
      window.removeEventListener("scroll", state.eventListeners.scroll);
      window.removeEventListener("resize", state.eventListeners.resize);
    }
    activeOverlays.delete(img);
  }
}

function adjustFontSize(boxEl, textEl, imgWidth, imgHeight, wPct, hPct, textLen) {
  const bubbleEl = textEl.parentElement;
  if (!bubbleEl) return;
  
  const boxH = imgHeight * (hPct / 100);
  
  // 1. Tính toán cỡ chữ cơ bản ban đầu dựa trên chiều cao hộp
  let baseSize = Math.min(28, Math.max(12, boxH * 0.42));
  
  // Áp dụng tỉ lệ phóng to/thu nhỏ tùy chỉnh của người dùng
  let fontSize = baseSize * currentFontSizeMultiplier;
  
  // Thiết lập font chữ ban đầu
  textEl.style.fontSize = `${fontSize}px`;
  textEl.style.fontFamily = currentFontFamily;
  
  // Kiểm tra an toàn xem phần tử đã được render lên DOM chưa
  if (bubbleEl.clientHeight === 0 || bubbleEl.clientWidth === 0) {
    return;
  }
  
  // Lấy các giá trị padding thực tế của bubbleEl từ computed style
  const computedStyle = window.getComputedStyle(bubbleEl);
  const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
  const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
  const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
  const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
  
  // Chiều cao và chiều rộng khả dụng thực tế bên trong vùng đệm padding (trừ thêm 2px biên an toàn)
  const availableHeight = Math.max(10, bubbleEl.clientHeight - paddingTop - paddingBottom - 2);
  const availableWidth = Math.max(10, bubbleEl.clientWidth - paddingLeft - paddingRight - 2);
  
  const minFontSize = 8;
  let safetyCounter = 0;
  
  // 2. Chạy vòng lặp đo lường thực tế trên DOM bằng scrollHeight và scrollWidth: giảm dần fontSize
  // cho đến khi văn bản nằm gọn hoàn toàn bên trong vùng trống khả dụng của bong bóng thoại
  while (fontSize > minFontSize && safetyCounter < 60) {
    const textHeight = textEl.scrollHeight;
    const textWidth = textEl.scrollWidth;
    
    // Nếu chiều cao chữ vượt quá không gian khả dụng OR chiều rộng chữ vượt quá không gian khả dụng
    if (textHeight > availableHeight || textWidth > availableWidth) {
      fontSize -= 0.5;
      textEl.style.fontSize = `${fontSize}px`;
      safetyCounter++;
    } else {
      break;
    }
  }
  
  // Đảm bảo không nhỏ dưới 8px để giữ độ đọc tối thiểu
  if (fontSize < minFontSize) {
    fontSize = minFontSize;
    textEl.style.fontSize = `${fontSize}px`;
  }
}
// ==========================================
// TÍNH NĂNG HOVER ĐỂ HIỂN THỊ NÚT DỊCH NHANH TRÊN ẢNH
// ==========================================

let hoverBtn = null;
let currentHoveredImg = null;

function createHoverButton() {
  if (hoverBtn) return hoverBtn;
  
  hoverBtn = document.createElement("button");
  hoverBtn.className = "manga-hover-translate-btn";
  hoverBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      <text x="5" y="13" font-size="7" font-weight="900" fill="currentColor" stroke="none" font-family="-apple-system, sans-serif">AI</text>
    </svg>
    <span>Dịch AI</span>
  `;
  
  document.body.appendChild(hoverBtn);
  
  hoverBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentHoveredImg) {
      triggerTranslationForImage(currentHoveredImg);
    }
    hoverBtn.style.display = "none";
  });
  
  // Giữ nút hiển thị khi đang hover chính nó
  hoverBtn.addEventListener("mouseenter", () => {
    hoverBtn.style.display = "flex";
  });
  
  hoverBtn.addEventListener("mouseleave", () => {
    hoverBtn.style.display = "none";
  });
  
  return hoverBtn;
}

// Bắt đầu dịch ảnh được chọn
function triggerTranslationForImage(img) {
  if (!img.dataset.mangaImageId) {
    img.dataset.mangaImageId = "manga-img-" + Math.random().toString(36).substr(2, 9);
  }
  const imageId = img.dataset.mangaImageId;
  
  // Gửi sự kiện yêu cầu dịch gửi lên Background Service Worker
  chrome.runtime.sendMessage({
    action: "request_translation",
    imageId: imageId,
    srcUrl: img.src
  });
}

function positionHoverButton(img, btn) {
  if (!img || !btn) return;
  const rect = img.getBoundingClientRect();
  btn.style.top = `${rect.top + window.scrollY + 10}px`;
  btn.style.left = `${rect.right + window.scrollX - btn.offsetWidth - 10}px`;
}

// Lắng nghe di chuột qua hình ảnh lớn trên trang web
document.addEventListener("mouseover", (e) => {
  const target = e.target;
  if (target && (target.tagName === "IMG" || target.tagName === "IMAGE")) {
    // Chỉ kích hoạt nút cho các ảnh đủ lớn (ví dụ manga page thường có chiều rộng/cao lớn hơn 180px)
    if (target.clientWidth > 180 && target.clientHeight > 180) {
      currentHoveredImg = target;
      const btn = createHoverButton();
      
      // Không hiện nút dịch nếu ảnh đang hiển thị dịch hoặc đang quay vòng loading
      const state = activeOverlays.get(target);
      if (state && (state.overlayContainer || state.loadingOverlay)) {
        btn.style.display = "none";
        return;
      }
      
      positionHoverButton(target, btn);
      btn.style.display = "flex";
    }
  }
}, { passive: true });

// Lắng nghe di chuột ra ngoài hình ảnh
document.addEventListener("mouseout", (e) => {
  const related = e.relatedTarget;
  if (hoverBtn && (!related || (related !== hoverBtn && !hoverBtn.contains(related) && related !== currentHoveredImg))) {
    hoverBtn.style.display = "none";
  }
}, { passive: true });

// ==========================================
// CHẾ ĐỘ CHỌN NHIỀU ẢNH DỊCH (BATCH SELECTION MODE)
// ==========================================

let isSelectionMode = false;
const selectedImages = new Set();

function enterSelectionMode() {
  if (isSelectionMode) return;
  isSelectionMode = true;
  selectedImages.clear();

  // 1. Quét trang web tìm các ảnh đủ điều kiện để hiển thị có thể chọn
  const images = document.querySelectorAll("img, image");
  images.forEach(img => {
    // Chiều rộng/cao lớn hơn 180px mới cho phép chọn
    if (img.clientWidth > 180 && img.clientHeight > 180) {
      img.classList.add("manga-selectable-image");
      // Gán mã ảnh nếu chưa có
      if (!img.dataset.mangaImageId) {
        img.dataset.mangaImageId = "manga-img-" + Math.random().toString(36).substr(2, 9);
      }
    }
  });

  // 2. Tạo thanh điều khiển ở dưới đáy trang (Floating Action Bar)
  const bar = document.createElement("div");
  bar.className = "manga-selection-bar";
  bar.innerHTML = `
    <div>ĐÃ CHỌN: <strong id="manga-select-count">0</strong> ẢNH</div>
    <button class="manga-confirm-translate-btn" disabled>DỊCH TẤT CẢ (0)</button>
    <button class="manga-cancel-select-btn">HỦY</button>
  `;
  document.body.appendChild(bar);

  // Hiển thị thanh với hiệu ứng trượt lên
  setTimeout(() => bar.classList.add("active"), 50);

  // Gắn sự kiện cho các nút trên thanh
  bar.querySelector(".manga-confirm-translate-btn").addEventListener("click", () => {
    confirmAndTranslateBatch();
  });
  bar.querySelector(".manga-cancel-select-btn").addEventListener("click", () => {
    exitSelectionMode();
  });

  // 3. Đăng ký sự kiện bắt click trên toàn trang (Capture phase) để ngăn hành động mặc định của ảnh
  document.addEventListener("click", handleSelectionClick, true);

  // Ẩn nút hover đơn lẻ khi đang ở chế độ chọn nhiều
  if (hoverBtn) hoverBtn.style.display = "none";
}

function handleSelectionClick(e) {
  if (!isSelectionMode) return;

  const bar = document.querySelector(".manga-selection-bar");
  if (bar && bar.contains(e.target)) return; // Không can thiệp click trong thanh điều khiển

  const target = e.target;
  // Tìm thẻ img
  const img = target.tagName === "IMG" ? target : target.querySelector("img");
  
  if (img && img.classList.contains("manga-selectable-image")) {
    e.preventDefault();
    e.stopPropagation();
    toggleImageSelection(img);
  }
}

function toggleImageSelection(img) {
  const imageId = img.dataset.mangaImageId;
  const confirmBtn = document.querySelector(".manga-confirm-translate-btn");
  const countEl = document.getElementById("manga-select-count");

  if (selectedImages.has(img)) {
    // Hủy chọn
    selectedImages.delete(img);
    img.classList.remove("manga-selected-image");

    // Xóa badge dấu tích xanh tương ứng
    const badge = document.querySelector(`.manga-selected-badge[data-for-image-id="${imageId}"]`);
    if (badge) {
      if (badge.updatePos) {
        window.removeEventListener("scroll", badge.updatePos);
        window.removeEventListener("resize", badge.updatePos);
      }
      badge.remove();
    }
  } else {
    // Chọn ảnh
    selectedImages.add(img);
    img.classList.add("manga-selected-image");

    // Tạo dấu tích xanh nổi lên góc ảnh
    const badge = document.createElement("div");
    badge.className = "manga-selected-badge";
    badge.dataset.forImageId = imageId;
    badge.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width: 13px; height: 13px;">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    `;
    document.body.appendChild(badge);

    const positionBadge = () => {
      if (!img || !badge) return;
      const rect = img.getBoundingClientRect();
      badge.style.top = `${rect.top + window.scrollY + 10}px`;
      badge.style.left = `${rect.left + window.scrollX + 10}px`;
    };
    positionBadge();

    badge.updatePos = positionBadge;
    window.addEventListener("scroll", positionBadge, { passive: true });
    window.addEventListener("resize", positionBadge, { passive: true });
  }

  // Cập nhật số lượng và trạng thái nút
  const count = selectedImages.size;
  if (countEl) countEl.textContent = count;
  if (confirmBtn) {
    confirmBtn.disabled = count === 0;
    confirmBtn.textContent = `DỊCH TẤT CẢ (${count})`;
  }
}

// Bắt đầu dịch đồng loạt các ảnh đã chọn bằng hàng đợi tuần tự (Queue) để tránh lỗi giới hạn 15 RPM
async function confirmAndTranslateBatch() {
  if (selectedImages.size === 0) return;

  const imagesToTranslate = Array.from(selectedImages);
  
  // Thoát chế độ chọn trước để làm sạch giao diện chọn
  exitSelectionMode();

  // Cấu hình giới hạn song song để tránh spam quá 15 RPM của Gemini
  const CONCURRENCY_LIMIT = 3;
  let activePromises = [];

  for (let img of imagesToTranslate) {
    // Nếu số lượng tiến trình đang chạy vượt quá giới hạn song song, đợi ít nhất 1 ảnh dịch xong
    if (activePromises.length >= CONCURRENCY_LIMIT) {
      await Promise.race(activePromises);
    }

    if (!img.dataset.mangaImageId) {
      img.dataset.mangaImageId = "manga-img-" + Math.random().toString(36).substr(2, 9);
    }
    const imageId = img.dataset.mangaImageId;

    // Tạo một promise theo dõi tiến trình dịch cho ảnh cụ thể này
    const translatePromise = new Promise((resolve) => {
      const onFinished = (message) => {
        if (message.imageId === imageId && (message.action === "draw_overlay" || message.action === "show_error")) {
          chrome.runtime.onMessage.removeListener(onFinished);
          resolve(); // Kết thúc tiến trình dịch của ảnh này
        }
      };
      // Đăng ký lắng nghe sự kiện trả về kết quả
      chrome.runtime.onMessage.addListener(onFinished);

      // Kích hoạt dịch ảnh đơn lẻ
      triggerTranslationForImage(img);
    });

    // Lưu promise vào danh sách đang chạy
    activePromises.push(translatePromise);
    translatePromise.then(() => {
      // Dọn dẹp promise khỏi mảng khi hoàn thành
      activePromises = activePromises.filter(p => p !== translatePromise);
    });

    // Tạo độ trễ nhỏ 500ms giữa các yêu cầu gửi đi để giãn cách băng thông
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Thoát chế độ chọn ảnh và dọn dẹp giao diện chọn
function exitSelectionMode() {
  isSelectionMode = false;

  // 1. Hủy bắt sự kiện click
  document.removeEventListener("click", handleSelectionClick, true);

  // 2. Xóa các badge dấu tích trên màn hình
  const badges = document.querySelectorAll(".manga-selected-badge");
  badges.forEach(badge => {
    if (badge.updatePos) {
      window.removeEventListener("scroll", badge.updatePos);
      window.removeEventListener("resize", badge.updatePos);
    }
    badge.remove();
  });

  // 3. Xóa các class CSS trên ảnh
  const images = document.querySelectorAll(".manga-selectable-image, .manga-selected-image");
  images.forEach(img => {
    img.classList.remove("manga-selectable-image", "manga-selected-image");
  });

  // 4. Xóa thanh điều khiển dưới đáy trang
  const bar = document.querySelector(".manga-selection-bar");
  if (bar) {
    bar.classList.remove("active");
    setTimeout(() => bar.remove(), 350); // Đợi hiệu ứng trượt ẩn kết thúc
  }
  
  selectedImages.clear();
}
