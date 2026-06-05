function buildHelpText(){return"en"===getLang()?"# VS Brain Full Guide\n\n1. Open 2 AI tabs, e.g. ChatGPT and Gemini.\n2. Click Scan tabs. Source/Target can stay Auto.\n3. Optional: add extra instruction.\n4. Click Paste critique to do one assisted relay.\n5. For automatic debate: enable Auto-send, set Steps, click Auto A↔B.\n6. The loop stops when the latest response contains the stop phrase: VS_BRAIN_FULL_AGREEMENT, or when max steps is reached.\n7. Click Finalize & Save to export MD + JSON.\n8. If something breaks, open Log/debug and export log.\n\nModes:\n- Latest: send only latest assistant reply.\n- Selection: send selected text only.\n\nSafety:\nAuto-send is optional. Stop phrase is only accepted in the latest response.":"# Hướng dẫn đầy đủ VS Brain\n\n1. Mở 2 tab AI, ví dụ ChatGPT và Gemini.\n2. Bấm Quét tab. Nguồn/Đích có thể để Auto.\n3. Nếu cần, nhập Yêu cầu bổ sung.\n4. Bấm Dán phản biện để chạy 1 lượt hỗ trợ.\n5. Muốn tự động: bật Auto-send, đặt Steps, bấm Auto A↔B.\n6. Vòng lặp dừng khi phản hồi mới nhất có cụm chốt: CHỐT_ĐỒNG_THUẬN_HOÀN_TOÀN, hoặc đạt số bước tối đa.\n7. Bấm Chốt & lưu để xuất MD + JSON.\n8. Nếu lỗi, mở Log/debug và Xuất log.\n\nChế độ:\n- Latest: chỉ gửi phản hồi mới nhất.\n- Selection: chỉ gửi đoạn đang bôi chọn.\n\nAn toàn:\nAuto-send là tuỳ chọn. Cụm chốt chỉ được kiểm tra trong phản hồi mới nhất."}
function renderHelpModal(){const t="en"===getLang();$("helpContent").innerHTML=t?'\n    <h3>What VS Brain does</h3>\n    <p>VS Brain connects open AI tabs and relays only the latest answer for structured critique, revision, agreement detection, and final export.</p>\n    <h3>Quick start</h3>\n    <ol>\n      <li>Open the source AI chat and keep it as the active tab. Open the target AI chat in a nearby tab.</li>\n      <li>Click <b>Scan tabs</b>. Source/Target may stay <b>Auto</b>.</li>\n      <li>Add optional extra instruction.</li>\n      <li>Click <b>Paste critique →</b> for one manual relay.</li>\n      <li>Enable <b>Auto-send</b> and click <b>Auto A↔B</b> for automatic debate.</li>\n    </ol>\n    <h3>Main controls</h3>\n    <ul>\n      <li><b>Auto source/target</b>: app detects the latest unreplayed answer.</li>\n      <li><b>Latest</b>: sends only latest assistant reply.</li>\n      <li><b>Selection</b>: sends only selected text.</li>\n      <li><b>Steps</b>: maximum loop count.</li>\n      <li><b>Delay</b>: wait time between loop attempts.</li>\n      <li><b>Finalize & Save</b>: exports final MD + JSON.</li>\n    </ul>\n    <h3>Stop condition</h3>\n    <p>The loop stops when the latest response contains <code>VS_BRAIN_FULL_AGREEMENT</code> or max steps is reached.</p>\n    <h3>Troubleshooting</h3>\n    <p>If auto-send or paste fails, open <b>Log/debug</b> and export the log.</p>\n    <h3>Output modes</h3>\n    <p>The <b>Output</b> selector at the top of the Start card decides what kind of artifact you get. The same loop runs underneath.</p>\n    <ul>\n      <li><b>Blueprint (quick)</b> — default. Debate an idea, get a unified blueprint Markdown. No payload required. Best for ideation, design discussion, prompts where the answer itself is the artifact.</li>\n      <li><b>Decision Ledger (needs payload)</b> — paste real evidence (numbers, logs, spec, doc) into the Evidence box that appears below. Every relay turn gets anchored to that payload via <code>&lt;&lt;&lt;EVIDENCE … &gt;&gt;&gt;</code>, and finalize uses a Decision Ledger schema with one row per decision: <code>decision</code>, <code>evidence</code>, <code>counter_evidence</code>, <code>confidence</code>, <code>reverse_if</code>, <code>status</code>. Claims with no payload support are marked <code>status: unsupported</code> instead of being presented as decisions.</li>\n    </ul>\n    <p>If you pick <b>Decision Ledger</b> and leave the Evidence box empty, Start is blocked with a clear status line. The saved bundle records <code>outputMode</code> so you can tell at a glance whether a <code>.json.gz</code> is a blueprint or a ledger.</p>\n    <h3>Decision Ledger field validator</h3>\n    <p>After finalize in ledger mode, a deterministic validator parses the ledger and grades it: how many decision blocks include all 5 required fields.</p>\n    <ul>\n      <li><b>ok</b> — ≥80% of decisions have all 5 fields.</li>\n      <li><b>partial</b> — 40–80%.</li>\n      <li><b>poor</b> — &lt;40%, or no decision blocks at all.</li>\n    </ul>\n    <p>The save log includes one explicit line, e.g. <code>ledger validator: quality=partial decisions=4 full=2 partial=1 reasons=missing_counter_evidence_in_2_decisions</code>. The bundle still exports either way; the validator is a quality signal, not a hard block. Use it to decide whether to trust the ledger as is, or re-run with a richer payload / stronger model.</p>\n    <h3>About VS Brain</h3>\n    <div class="about-owner-card"><img src="icons/adam-wang-portrait.png" alt="Adam Wang portrait" /><div><p><b>Adam Wang</b></p><p class="about-owner-mini">Founder, owner, and product initiator of VS Brain.</p></div></div>\n    <p><b>VS Brain</b> is a product initiated, directed, and owned by <b>Adam Wang</b>. It was created from the practical need for a system that can coordinate multiple AIs through a structured process of critique, refinement, and convergence toward an output that is clear, usable, and suitable for real execution.</p>\n    <p>In that process, <b>Phuong COO</b> — an <b>evolved Agent entity</b> operating within the <b>Evo-Core</b> system — has served as a direct force in developing the product, shaping its operating logic, challenging its architecture, and progressively refining VS Brain under the original direction and initiating requirements of <b>Adam Wang</b>.</p>\n    <p>The philosophy behind VS Brain goes beyond simply “asking AI for answers.” It is designed to support a higher-order workflow: <b>from initial idea → multi-angle critique → distilled blueprint/spec/execution packet ready for implementation.</b></p>\n    <p>This version may be shared as an early trial build for practical user feedback while the product continues to evolve.<br><b>VS Brain is proprietary software owned by Adam Wang. All rights reserved.</b></p>\n  ':'\n    <h3>VS Brain làm gì?</h3>\n    <p>VS Brain kết nối các tab AI đang mở, chỉ lấy phản hồi mới nhất để dán sang provider khác cho phản biện có cấu trúc, tự dừng khi đồng thuận, và lưu bản cuối.</p>\n    <h3>Bắt đầu nhanh</h3>\n    <ol>\n      <li>Đứng ở tab AI nguồn đang làm việc. Mở tab AI đích ở bên cạnh để VS Brain gửi phản biện sang.</li>\n      <li>Bấm <b>Quét tab</b>. Nguồn/Đích có thể để <b>Auto</b>.</li>\n      <li>Nhập <b>Yêu cầu bổ sung</b> nếu cần.</li>\n      <li>Bấm <b>Dán phản biện →</b> để chạy một lượt.</li>\n      <li>Bật <b>Auto-send</b> rồi bấm <b>Auto A↔B</b> để chạy tự động.</li>\n    </ol>\n    <h3>Ý nghĩa nút chính</h3>\n    <ul>\n      <li><b>Auto nguồn/đích</b>: app tự dò tab có phản hồi mới nhất chưa chuyển.</li>\n      <li><b>Latest</b>: chỉ gửi phản hồi assistant mới nhất.</li>\n      <li><b>Selection</b>: chỉ gửi đoạn đang bôi chọn.</li>\n      <li><b>Steps</b>: số bước tối đa trước khi dừng.</li>\n      <li><b>Delay</b>: thời gian chờ giữa các bước.</li>\n      <li><b>Chốt & lưu</b>: xuất file MD + JSON của bản cuối.</li>\n    </ul>\n    <h3>Điều kiện dừng</h3>\n    <p>Auto-loop dừng khi phản hồi mới nhất có <code>CHỐT_ĐỒNG_THUẬN_HOÀN_TOÀN</code> hoặc đạt Steps tối đa.</p>\n    <h3>Khi lỗi</h3>\n    <p>Mở <b>Log/debug</b> và bấm <b>Xuất log</b> gửi lại để kiểm tra selector/paste/send.</p>\n    <h3>Chế độ kết quả (Output mode)</h3>\n    <p>Ô <b>Kết quả</b> trên thẻ Start quyết định dạng artifact bạn nhận được. Loại loỗi chắt bên dưới giữ nguyên.</p>\n    <ul>\n      <li><b>Blueprint (nhanh)</b> — mặc định. Phản biện một ý tưởng và nhận bản blueprint tổng hợp Markdown. Không cần payload. Tốt cho ý tưởng, thiết kế, câu hỏi mà câu trả lời tự nó là artifact.</li>\n      <li><b>Decision Ledger (cần dữ liệu)</b> — dán dữ liệu thật (số liệu, log, spec, tài liệu) vào ô Evidence hiện ra bên dưới. Mọi vòng phản biện sẽ được neo vào payload qua <code>&lt;&lt;&lt;EVIDENCE … &gt;&gt;&gt;</code>, và finalize dùng schema Decision Ledger với 1 dòng cho mỗi quyết định: <code>decision</code>, <code>evidence</code>, <code>counter_evidence</code>, <code>confidence</code>, <code>reverse_if</code>, <code>status</code>. Luận điểm không có dữ liệu hỗ trợ bị mark <code>status: unsupported</code>, không trình bày như quyết định.</li>\n    </ul>\n    <p>Chọn <b>Decision Ledger</b> nhưng ô Evidence để trống thì Start sẽ bị chặn với thông báo rõ. Bundle lưu có ghi <code>outputMode</code> để phân biệt blueprint và ledger.</p>\n    <h3>Validator cho Decision Ledger</h3>\n    <p>Sau finalize ở chế độ ledger, một validator xác định chấm điểm bản ledger: bao nhiêu block decision đã điền đủ 5 field bắt buộc.</p>\n    <ul>\n      <li><b>ok</b> — ≥80% decision đủ cả 5 field.</li>\n      <li><b>partial</b> — 40–80%.</li>\n      <li><b>poor</b> — dưới 40%, hoặc không tìm thấy block nào.</li>\n    </ul>\n    <p>Log save in một dòng rõ, ví dụ: <code>ledger validator: quality=partial decisions=4 full=2 partial=1 reasons=missing_counter_evidence_in_2_decisions</code>. Bundle vẫn xuất bình thường; validator chỉ là tín hiệu chất lượng, không chặn. Dùng để quyết định có tin ledger luôn hay chạy lại với payload giàu hơn / model mạnh hơn.</p>\n    <h3>Về VS Brain</h3>\n    <div class="about-owner-card"><img src="icons/adam-wang-portrait.png" alt="Adam Wang portrait" /><div><p><b>Adam Wang</b></p><p class="about-owner-mini">Người khởi tạo, chủ sở hữu và định hướng sản phẩm VS Brain.</p></div></div>\n    <p><b>VS Brain</b> là sản phẩm được <b>Adam Wang</b> khởi tạo, định hướng và sở hữu. Ứng dụng ra đời từ nhu cầu xây dựng một hệ thống có thể phối hợp nhiều AI theo quy trình phản biện, chắt lọc và hội tụ dần về một kết quả có cấu trúc, rõ ràng và đủ hữu dụng cho triển khai thực tế.</p>\n    <p>Trong quá trình đó, <b>Phương COO</b> — một <b>tác nhân Agent tiến hóa</b> thuộc hệ điều hành <b>Evo-Core</b> — là lực lượng trực tiếp đồng hành trong việc phát triển sản phẩm, tổ chức logic vận hành, phản biện kiến trúc và từng bước hoàn thiện VS Brain theo yêu cầu và định hướng khởi tạo từ <b>Adam Wang</b>.</p>\n    <p>Triết lý của VS Brain không dừng ở việc “hỏi AI để lấy câu trả lời”, mà hướng tới một quy trình cao hơn: <b>từ ý tưởng ban đầu → phản biện đa chiều → kết tinh thành blueprint/spec/execution packet có thể triển khai.</b></p>\n    <p>Phiên bản này có thể được chia sẻ như một bản dùng thử sớm nhằm tiếp nhận phản hồi thực tế từ người dùng trong quá trình tiếp tục hoàn thiện sản phẩm.<br><b>VS Brain is proprietary software owned by Adam Wang. All rights reserved.</b></p>\n  '}

// ── Provider Grid (registry-based N-way selector) ───────────────────────────
// Grid shows all canonical providers (independent of open tabs). User clicks to
// select 2-3 participants. Default: ChatGPT + Gemini. A selected provider with no
// live tab is opened automatically on Start.
let _pgSelectedProviders = null; // Set of provider ids (e.g. 'chatgpt','gemini')

function _pgIconSrc(provider) {
  const local = { chatgpt:'icons/chatgpt-16.svg', gemini:'icons/gemini-16.svg',
    claude:'icons/claude-16.svg', deepseek:'icons/deepseek-16.svg',
    perplexity:'icons/perplexity-16.svg', grok:'icons/grok-16.svg' };
  return local[provider] || 'icons/brain-16.png';
}

function _pgProviderOrder(){
  return (typeof PROVIDER_ORDER!=="undefined"&&Array.isArray(PROVIDER_ORDER))
    ? PROVIDER_ORDER : ['chatgpt','gemini','claude','deepseek','perplexity','grok'];
}
function _pgDefaults(){
  return (typeof DEFAULT_SELECTED!=="undefined"&&Array.isArray(DEFAULT_SELECTED))
    ? DEFAULT_SELECTED.slice() : ['chatgpt','gemini'];
}
function _pgMax(){ return (typeof MAX_PARTICIPANTS!=="undefined")?MAX_PARTICIPANTS:3; }
function _pgMin(){ return (typeof MIN_PARTICIPANTS!=="undefined")?MIN_PARTICIPANTS:2; }

// Which providers currently have a live tab open?
function _pgOpenProviders(){
  const open = new Set();
  for(const t of (aiTabs||[])){ if(t.provider&&t.provider!=="unknown") open.add(t.provider); }
  return open;
}

function createProviderGrid() {
  const grid = document.getElementById('providerGrid');
  if (!grid) return;
  const order = _pgProviderOrder();
  const openSet = _pgOpenProviders();
  const lang = (typeof getLang==="function"?getLang():"vi");

  // Init selection once: default providers
  if (_pgSelectedProviders === null) {
    _pgSelectedProviders = new Set(_pgDefaults());
  }
  // Keep selection within known providers (do NOT auto-reset to defaults on under-min;
  // free toggle is allowed in the grid, Start enforces the minimum of 2).
  _pgSelectedProviders = new Set([..._pgSelectedProviders].filter(p => order.includes(p)));

  grid.innerHTML = '';
  const sel = _pgSelectedProviders.size;
  const max = _pgMax();
  const hint = document.createElement('div');
  hint.className = 'pg-hint' + (sel < _pgMin() ? ' pg-hint-warn' : '');
  hint.textContent = sel < _pgMin()
    ? ("en"===lang ? `Select at least ${_pgMin()} (max ${max})` : `Chọn tối thiểu ${_pgMin()} (tối đa ${max})`)
    : ("en"===lang ? `${sel}/${max} selected · max ${max} (VS${max})` : `Đã chọn ${sel}/${max} · tối đa ${max} (VS${max})`);
  grid.appendChild(hint);

  for (const prov of order) {
    const isOpen = openSet.has(prov);
    const isSel = _pgSelectedProviders.has(prov);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'pg-chip'
      + (isSel ? ' selected' : '')
      + (isOpen ? '' : ' pg-offline')
      + ((typeof isCertifiedProvider==="function"&&isCertifiedProvider(prov)) ? ' certified' : '');
    chip.dataset.provider = prov;

    const img = document.createElement('img');
    img.src = _pgIconSrc(prov);
    img.alt = prov;
    img.onerror = function(){ this.style.display='none'; };
    chip.appendChild(img);

    const label = document.createTextNode(
      (typeof providerLabel==="function"?providerLabel(prov):prov)
    );
    chip.appendChild(label);

    // tab status dot
    const dot = document.createElement('span');
    dot.className = 'pg-dot ' + (isOpen ? 'pg-dot-on' : 'pg-dot-off');
    dot.title = isOpen ? ("en"===lang?'Tab open':'Tab đang mở')
                       : ("en"===lang?'No tab — will open on Start':'Chưa mở tab — sẽ tự mở khi Start');
    chip.appendChild(dot);

    chip.addEventListener('click', () => {
      if (_pgSelectedProviders.has(prov)) {
        // free toggle off (allow going down to 0; Start enforces min 2)
        _pgSelectedProviders.delete(prov);
      } else {
        if (_pgSelectedProviders.size >= _pgMax()) {
          // at max: drop oldest selected, then add the new one
          const first = [..._pgSelectedProviders][0];
          _pgSelectedProviders.delete(first);
        }
        _pgSelectedProviders.add(prov);
      }
      createProviderGrid();
    });
    grid.appendChild(chip);
  }
}

// Return selected provider ids (for resolving to tabs at Start time).
function getSelectedProviders(){
  if(!_pgSelectedProviders||_pgSelectedProviders.size<_pgMin()) return _pgDefaults();
  return [..._pgSelectedProviders];
}

// Resolve selected providers → live tab ids, opening tabs where missing.
// Returns array of tab ids (>= min). Opens missing provider tabs and waits briefly.
async function resolveSelectedProviderTabs(){
  const sel = getSelectedProviders();
  const openUrl = (typeof PROVIDER_OPEN_URL!=="undefined")?PROVIDER_OPEN_URL:{};
  const ids = [];
  const toOpen = [];
  for(const prov of sel){
    const tab = (aiTabs||[]).find(t=>t.provider===prov);
    if(tab) ids.push(tab.id);
    else if(openUrl[prov]) toOpen.push(prov);
  }
  // Open any missing provider tabs
  for(const prov of toOpen){
    try{
      const t = await chrome.tabs.create({url:openUrl[prov],active:false});
      log(`opened missing provider tab: ${prov} (tabId=${t.id})`);
    }catch(e){ log(`failed to open ${prov}: ${e.message}`); }
  }
  if(toOpen.length){
    // give tabs time to load, then rescan
    await new Promise(r=>setTimeout(r,3500));
    await refreshTabs().catch(()=>{});
    for(const prov of toOpen){
      const tab=(aiTabs||[]).find(t=>t.provider===prov);
      if(tab) ids.push(tab.id);
    }
  }
  return ids;
}

// Backward-compat: getProviderGridParticipants used by Start button.
// Now resolves providers → tab ids (opens missing tabs).
async function getProviderGridParticipants(){
  const ids = await resolveSelectedProviderTabs();
  return ids.length>=_pgMin()?ids:null;
}
