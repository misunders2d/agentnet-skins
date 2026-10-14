// Presentation only. The existing host validates owner, live RPC and one-shot response.
export function nativeRequestItem(el, report, item, host, journal, sendID, localAddress, refresh, later) {
  const n = item.native;
  if (!n || n.host !== report.report.host || n.request !== item.id || n.key !== item.key || n.attempt !== item.attempt) return null;
  const cacheKey = [host.workspace?.id, host.workspace?.endpoint, n.host, n.token].join("|");
  let state = journal.get(cacheKey);
  if (!state) { state = { answers: {}, values: {}, prepared: null, busy: false, sent: false }; journal.set(cacheKey, state); }
  if (item.result?.refused && item.result.decision !== state.refusal) {
    state.refusal = item.result.decision; state.prepared = null; state.sent = false;
  }
  const expired = () => n.expires > 0 && Date.now() >= n.expires;
  const feedback = el("p", { class: "hint", role: "status" });
  const inputs = [], buttons = [], fields = [];
  const ready = () => (n.questions || []).every(q => !!state.answers[q.id]?.trim()) && (n.fields || []).every(f => !f.required || Object.hasOwn(state.values, f.id));
  const renderState = () => {
    const closed = expired() || state.sent || !!item.result && !item.result.refused;
    for (const input of inputs) input.disabled = closed || state.busy || !!state.prepared;
    for (const [choice, button] of buttons) {
      button.disabled = closed || state.busy || !!state.prepared && state.prepared.choice !== choice || choice === "submit" && !ready();
      button.textContent = state.busy ? "Sending…" : state.prepared?.choice === choice && !state.sent ? "Retry response" : labels[choice];
    }
    if (expired()) feedback.textContent = "This native request expired. No response can be applied to it.";
    else if (state.sent || item.result && !item.result.refused) feedback.textContent = "Response saved. Waiting for the host’s result; saved does not mean completed.";
    else if (state.error) feedback.textContent = state.error;
    else if (item.result?.refused) feedback.textContent = "Not applied: " + item.result.refused;
  };
  const labels = { allow: "Allow this action", deny: "Deny this action", cancel: "Cancel", submit: "Send native answer" };
  for (const q of n.questions || []) {
    let input;
    if (q.options?.length && !q.isOther && !q.isSecret) {
      input = el("select", { "aria-label": q.question }, el("option", { value: "", disabled: true }, "Choose an answer"), q.options.map((o, i) => el("option", { value: String(i) }, o.label + (o.description ? " — " + o.description : ""))));
      const chosen = q.options.findIndex(o => o.label === state.answers[q.id]); input.value = chosen < 0 ? "" : String(chosen);
      input.onchange = () => { state.answers[q.id] = q.options[Number(input.value)].label; renderState(); };
    } else {
      input = el("input", { type: q.isSecret ? "password" : "text", autocomplete: "off", "aria-label": q.question }); input.value = state.answers[q.id] || "";
      input.oninput = () => { state.answers[q.id] = input.value; renderState(); };
    }
    inputs.push(input); fields.push(el("label", { class: "native-field" }, el("strong", {}, q.question), input,
      q.isOther && q.options?.length && !q.isSecret ? el("span", { class: "hint" }, "Choices: " + q.options.map(o => o.label).join(", ") + ". You can also write an answer.") : null));
  }
  for (const f of n.fields || []) {
    let input;
    if (f.type === "boolean" || f.enum?.length) {
      const choices = f.type === "boolean" ? [true, false] : f.enum;
      input = el("select", { "aria-label": f.title || f.id }, el("option", { value: "", disabled: !!f.required }, "Choose a value"), choices.map((v, i) => el("option", { value: String(i) }, String(v))));
      const chosen = choices.indexOf(state.values[f.id]); input.value = chosen < 0 ? "" : String(chosen);
      input.onchange = () => { if (input.value === "") delete state.values[f.id]; else state.values[f.id] = choices[Number(input.value)]; renderState(); };
    } else {
      input = el("input", { "aria-label": f.title || f.id, autocomplete: "off" }); input.value = state.values[f.id] ?? "";
      input.oninput = () => { state.values[f.id] = input.value; renderState(); };
    }
    inputs.push(input); fields.push(el("label", { class: "native-field" }, el("strong", {}, (f.title || f.id) + (f.required ? " (required)" : "")), f.description && el("span", { class: "hint" }, f.description), input));
  }
  const submit = async choice => {
    renderState();
    if (state.busy || state.sent || expired() || item.result && !item.result.refused || state.prepared && state.prepared.choice !== choice || choice === "submit" && !ready()) return;
    state.prepared ||= { choice, id: sendID(), report: report.id, text: "agentnet-native-response-v1\n" + JSON.stringify({ token: n.token, choice,
      ...(choice === "submit" && n.questions?.length ? { answers: state.answers } : {}), ...(choice === "submit" && n.fields?.length ? { values: state.values } : {}) }) };
    state.busy = true; state.error = ""; renderState();
    try {
      const p = state.prepared, local = host.platform !== "browser" && n.host === localAddress;
      if (local) await host.api("/api/act", { do: "continue", id: n.request, key: n.key, attempt: n.attempt, body: p.text, send_id: p.id });
      else await host.api("/api/operator/decide", { host: n.host, id: n.request, key: n.key, attempt: n.attempt, action: "continue", expect: "running", text: p.text, report: p.report, send_id: p.id });
      state.sent = true; state.answers = {}; state.values = {}; delete state.prepared.text;
      for (const input of inputs) input.value = "";
    } catch (error) { state.error = error.message || "Could not save this response. Retry the same response."; }
    finally { state.busy = false; renderState(); void refresh?.(); }
  };
  for (const choice of n.choices || []) if (labels[choice]) {
    const button = el("button", { type: "button", class: "act" + (choice === "allow" || choice === "submit" ? " go" : ""), onclick: () => void submit(choice) }, labels[choice]); buttons.push([choice, button]);
  }
  const root = el("li", { class: "report-request native-request", "aria-label": "Codex native request" },
    el("strong", {}, "Codex native request"), el("p", { class: "hint" }, "Your Codex setup asks for this permission or input. Your response continues the same pending operation; native settings stay unchanged."),
    n.cwd && el("p", { class: "hint" }, "Working folder: " + n.cwd), n.operation && el("pre", { class: "native-operation" }, n.operation),
    n.reason && el("p", {}, n.reason), n.unsupported && el("p", { class: "hint" }, n.unsupported), fields,
    el("div", { class: "acts" }, buttons.map(([, button]) => button)), feedback);
  if (n.expires > 0 && !expired()) later?.(renderState, Math.max(0, n.expires - Date.now()));
  renderState(); return root;
}
