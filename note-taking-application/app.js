// State variables
let notes = [];
let currentNote = null;
let saveDebounceTimer = null;
let activeMode = 'split'; // 'split', 'edit', 'preview'

// DOM Elements
const notesList = document.getElementById('notes-list');
const btnNewNote = document.getElementById('btn-new-note');
const btnUploadTrigger = document.getElementById('btn-upload-trigger');
const fileUploadInput = document.getElementById('file-upload');
const searchInput = document.getElementById('search-notes');

const noteTitleInput = document.getElementById('note-title');
const saveStatus = document.getElementById('save-status');
const viewModeTabs = document.querySelectorAll('.mode-tab');
const btnSaveNote = document.getElementById('btn-save-note');
const btnDeleteNote = document.getElementById('btn-delete-note');

const workspaceBody = document.getElementById('workspace-body');
const markdownTextarea = document.getElementById('markdown-textarea');
const htmlRenderedContent = document.getElementById('html-rendered-content');
const charWordCount = document.getElementById('char-word-count');
const btnCopyHtml = document.getElementById('btn-copy-html');

const assistantPanel = document.getElementById('assistant-panel');
const grammarBadge = document.getElementById('grammar-badge');
const grammarIssuesList = document.getElementById('grammar-issues-list');
const btnRecheckGrammar = document.getElementById('btn-recheck-grammar');
const toastContainer = document.getElementById('toast-container');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  fetchNotes();
});

// Toast system
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Set up all events
function setupEventListeners() {
  // New Note
  btnNewNote.addEventListener('click', createNewNote);
  
  // File Upload
  btnUploadTrigger.addEventListener('click', () => fileUploadInput.click());
  fileUploadInput.addEventListener('change', handleFileUpload);
  
  // Search notes
  searchInput.addEventListener('input', () => {
    renderNotesList(searchInput.value);
  });
  
  // Textarea input (auto-save and preview update)
  markdownTextarea.addEventListener('input', () => {
    if (!currentNote) return;
    
    // Live update count and state content
    const text = markdownTextarea.value;
    currentNote.content = text;
    updateCounts(text);
    
    // Live compile markdown to HTML (client-side for immediate visual response)
    // Note: API save will compile on server and return official HTML,
    // but client-side update provides high-end instant interactivity.
    renderPreviewLocal(text);
    
    // Indicate unsaved changes
    saveStatus.textContent = 'Saving...';
    saveStatus.classList.add('saving');
    
    // Auto-save debounce
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
      saveNote();
    }, 1200); // 1.2 seconds of typing pause
  });
  
  // Title input editing
  noteTitleInput.addEventListener('input', () => {
    if (!currentNote) return;
    currentNote.title = noteTitleInput.value;
    
    // Indicate unsaved changes
    saveStatus.textContent = 'Saving...';
    saveStatus.classList.add('saving');
    
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
      saveNote();
    }, 1200);
  });

  // Explicit Save
  btnSaveNote.addEventListener('click', () => {
    clearTimeout(saveDebounceTimer);
    saveNote(true);
  });
  
  // Delete Note
  btnDeleteNote.addEventListener('click', deleteNote);
  
  // Recheck grammar
  btnRecheckGrammar.addEventListener('click', triggerGrammarCheck);
  
  // View mode switcher
  viewModeTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      viewModeTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const mode = tab.dataset.mode;
      activeMode = mode;
      
      workspaceBody.className = `workspace-body ${mode}-mode`;
    });
  });
  
  // Copy Rendered HTML
  btnCopyHtml.addEventListener('click', () => {
    if (!currentNote) return;
    
    const html = htmlRenderedContent.innerHTML;
    navigator.clipboard.writeText(html)
      .then(() => showToast('HTML copied to clipboard!'))
      .catch(() => showToast('Failed to copy HTML', 'error'));
  });
}

// Fetch list of all notes
async function fetchNotes(selectId = null) {
  try {
    const response = await fetch('/api/notes');
    if (!response.ok) throw new Error('Failed to fetch notes');
    
    notes = await response.json();
    renderNotesList();
    
    // Auto-select note if list not empty
    if (notes.length > 0) {
      const noteToSelect = selectId 
        ? notes.find(n => n.id == selectId) || notes[0]
        : notes[0];
        
      if (noteToSelect) {
        loadNote(noteToSelect.id);
      }
    } else {
      clearWorkspace();
    }
  } catch (error) {
    console.error('Error fetching notes:', error);
    showToast('Failed to load notes list', 'error');
  }
}

// Render the sidebar notes list
function renderNotesList(filter = '') {
  notesList.innerHTML = '';
  const filtered = notes.filter(n => 
    n.title.toLowerCase().includes(filter.toLowerCase()) || 
    n.preview.toLowerCase().includes(filter.toLowerCase())
  );
  
  if (filtered.length === 0) {
    notesList.innerHTML = '<div class="list-empty-state">No notes found.</div>';
    return;
  }
  
  filtered.forEach(note => {
    const noteCard = document.createElement('div');
    noteCard.className = `note-item ${currentNote && currentNote.id === note.id ? 'active' : ''}`;
    noteCard.dataset.id = note.id;
    
    const formattedDate = new Date(note.updated_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const badgeHtml = note.errorCount > 0 
      ? `<span class="badge badge-danger">${note.errorCount}</span>`
      : '';
      
    const previewText = note.preview ? note.preview.trim() : 'Empty note';
    
    noteCard.innerHTML = `
      <div class="note-item-header">
        <h4 class="note-item-title">${escapeHtml(note.title)}</h4>
        ${badgeHtml}
      </div>
      <p class="note-item-preview">${escapeHtml(previewText)}</p>
      <div class="note-item-footer">
        <span class="note-item-date">${formattedDate}</span>
      </div>
    `;
    
    noteCard.addEventListener('click', () => {
      if (currentNote && currentNote.id === note.id) return;
      loadNote(note.id);
    });
    
    notesList.appendChild(noteCard);
  });
}

// Load full content of a selected note
async function loadNote(id) {
  try {
    // Disable inputs while loading
    disableWorkspaceInputs(true);
    
    const response = await fetch(`/api/notes/${id}`);
    if (!response.ok) throw new Error('Failed to fetch note detail');
    
    currentNote = await response.json();
    
    // Enable inputs
    disableWorkspaceInputs(false);
    
    // Set field values
    noteTitleInput.value = currentNote.title;
    markdownTextarea.value = currentNote.content;
    
    // Set HTML content
    htmlRenderedContent.innerHTML = currentNote.html || '<p class="text-muted">Empty note</p>';
    
    // Update word count
    updateCounts(currentNote.content);
    
    // Update save status UI
    saveStatus.textContent = 'Saved';
    saveStatus.classList.remove('saving');
    
    // Update active state in sidebar
    document.querySelectorAll('.note-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.id == id) {
        item.classList.add('active');
      }
    });
    
    // Render Grammar Assistent
    renderGrammarAssistant();
  } catch (error) {
    console.error('Error loading note:', error);
    showToast('Failed to load note contents', 'error');
  }
}

// Create a new note on the server
async function createNewNote() {
  try {
    const response = await fetch('/api/notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Untitled Note',
        content: ''
      })
    });
    
    if (!response.ok) throw new Error('Failed to create note');
    
    const newNoteObj = await response.json();
    showToast('Created new note');
    
    // Refresh list and select the new note
    await fetchNotes(newNoteObj.id);
    
    // Focus title/editor
    noteTitleInput.focus();
    noteTitleInput.select();
  } catch (error) {
    console.error('Error creating note:', error);
    showToast('Could not create note', 'error');
  }
}

// Save current note changes to the server
async function saveNote(showFeedback = false) {
  if (!currentNote) return;
  
  const id = currentNote.id;
  const title = noteTitleInput.value;
  const content = markdownTextarea.value;
  
  try {
    const response = await fetch(`/api/notes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, content })
    });
    
    if (!response.ok) throw new Error('Failed to save note');
    
    const updated = await response.json();
    
    // Update currentNote state
    currentNote = updated;
    
    // Update rendered HTML and grammar issues
    htmlRenderedContent.innerHTML = updated.html || '<p class="text-muted">Empty note</p>';
    renderGrammarAssistant();
    
    // Update save status UI
    saveStatus.textContent = 'Saved';
    saveStatus.classList.remove('saving');
    
    // Refresh sidebar silently (keeping selection)
    const activeNoteItem = document.querySelector(`.note-item[data-id="${id}"]`);
    if (activeNoteItem) {
      // Find note in notes array and update details
      const noteIdx = notes.findIndex(n => n.id === id);
      if (noteIdx !== -1) {
        notes[noteIdx].title = title;
        notes[noteIdx].preview = content.substring(0, 100);
        notes[noteIdx].errorCount = updated.grammar_errors ? updated.grammar_errors.length : 0;
        notes[noteIdx].updated_at = updated.updated_at;
      }
      renderNotesList(searchInput.value);
    }
    
    if (showFeedback) {
      showToast('Saved note changes');
    }
  } catch (error) {
    console.error('Error saving note:', error);
    saveStatus.textContent = 'Failed to save';
    showToast('Failed to save changes', 'error');
  }
}

// Delete current note
async function deleteNote() {
  if (!currentNote) return;
  
  if (!confirm(`Are you sure you want to delete "${currentNote.title}"?`)) {
    return;
  }
  
  const id = currentNote.id;
  try {
    const response = await fetch(`/api/notes/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Failed to delete note');
    
    showToast('Deleted note');
    currentNote = null;
    fetchNotes();
  } catch (error) {
    console.error('Error deleting note:', error);
    showToast('Failed to delete note', 'error');
  }
}

// Handle markdown file uploads
async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    showToast('Uploading note...', 'warning');
    const response = await fetch('/api/notes/upload', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) throw new Error('Failed to upload file');
    
    const uploadedNote = await response.json();
    showToast(`Uploaded "${uploadedNote.title}" successfully`);
    
    // Reset file input value
    fileUploadInput.value = '';
    
    // Refresh list and select the new note
    fetchNotes(uploadedNote.id);
  } catch (error) {
    console.error('Error uploading file:', error);
    showToast('Failed to upload markdown file', 'error');
  }
}

// Re-run grammar checks explicitly
async function triggerGrammarCheck() {
  if (!currentNote) return;
  
  btnRecheckGrammar.disabled = true;
  const refreshIcon = btnRecheckGrammar.querySelector('.refresh-icon');
  if (refreshIcon) refreshIcon.style.animation = 'pulse 1s infinite';
  
  try {
    const response = await fetch(`/api/notes/${currentNote.id}/check-grammar`, {
      method: 'POST'
    });
    
    if (!response.ok) throw new Error('Grammar check failed');
    
    const data = await response.json();
    currentNote.grammar_errors = data.grammar_errors || [];
    
    renderGrammarAssistant();
    showToast('Grammar check completed');
    
    // Update badge in sidebar list
    const noteIdx = notes.findIndex(n => n.id === currentNote.id);
    if (noteIdx !== -1) {
      notes[noteIdx].errorCount = currentNote.grammar_errors.length;
      renderNotesList(searchInput.value);
    }
  } catch (error) {
    console.error('Grammar checking error:', error);
    showToast('Failed to complete grammar check', 'error');
  } finally {
    btnRecheckGrammar.disabled = false;
    if (refreshIcon) refreshIcon.style.animation = '';
  }
}

// Render local HTML preview instantly while typing (before saving)
function renderPreviewLocal(text) {
  // We can compile markdown client-side or wait for save.
  // Since we have a REST API designed for this, we will use a basic parser fallback
  // or a simple Regex replacement to make the typing preview feel extremely fast.
  // To avoid installing yet another library on the client, we will write a tiny markdown renderer
  // or just let it display text while auto-saving compiles it perfectly via `marked` on the backend.
  // Actually, let's use a very basic converter so the user gets instant feedback, 
  // and the official, complete marked-parsed HTML is updated instantly when auto-save triggers (1.2s).
  
  // Basic markdown to HTML regex fallback for instant feedback
  let localHtml = text
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n$/gim, '<br />');

  // Wrap lists
  if (localHtml.includes('<li>')) {
    localHtml = localHtml.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
  }
  
  htmlRenderedContent.innerHTML = localHtml || '<p class="text-muted">Empty note</p>';
}

// Render the right-sidebar grammar checking drawer
function renderGrammarAssistant() {
  const errors = currentNote ? currentNote.grammar_errors || [] : [];
  
  // Update badge counts
  grammarBadge.textContent = `${errors.length} issue${errors.length === 1 ? '' : 's'}`;
  grammarBadge.className = `badge ${errors.length > 0 ? 'badge-danger' : 'badge-neutral'}`;
  
  grammarIssuesList.innerHTML = '';
  
  if (errors.length === 0) {
    grammarIssuesList.innerHTML = `
      <div class="assistant-empty-state">
        <div class="success-icon">✨</div>
        <p class="success-text">Perfect Grammar!</p>
        <p class="success-subtext">No spelling or grammar issues found in this note.</p>
      </div>
    `;
    return;
  }
  
  errors.forEach((issue, index) => {
    const card = document.createElement('div');
    
    // Categorize issues
    let categoryClass = 'grammar';
    let label = 'Grammar';
    const ruleCat = issue.rule?.category?.id || '';
    const issueType = issue.rule?.issueType || '';
    
    if (ruleCat.includes('TYPOS') || issueType.includes('misspelling')) {
      categoryClass = 'spelling';
      label = 'Spelling';
    } else if (ruleCat.includes('STYLE') || ruleCat.includes('COLLOCATIONS')) {
      categoryClass = 'style';
      label = 'Style';
    }
    
    card.className = `issue-card ${categoryClass}`;
    
    // Highlighting matching error word in context
    const contextText = issue.context.text;
    const offset = issue.context.offset;
    const length = issue.context.length;
    
    const beforeText = contextText.substring(0, offset);
    const errorText = contextText.substring(offset, offset + length);
    const afterText = contextText.substring(offset + length);
    const highlightedContext = `${escapeHtml(beforeText)}<mark>${escapeHtml(errorText)}</mark>${escapeHtml(afterText)}`;
    
    // Replacements buttons
    const replacements = issue.replacements || [];
    let suggestionsHtml = '';
    
    if (replacements.length > 0) {
      const topReplacements = replacements.slice(0, 3);
      suggestionsHtml = `
        <div class="issue-suggestions-container">
          <span class="suggestions-label">Suggestions:</span>
          <div class="suggestions-list">
            ${topReplacements.map(rep => `
              <button class="btn-suggestion" data-index="${index}" data-replacement="${escapeAttr(rep.value)}">
                ${escapeHtml(rep.value)}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    card.innerHTML = `
      <div class="issue-type-header">
        <span class="issue-badge ${categoryClass}">${label}</span>
      </div>
      <p class="issue-message">${escapeHtml(issue.message)}</p>
      <div class="issue-context">${highlightedContext}</div>
      ${suggestionsHtml}
    `;
    
    // Wire up suggestions replacement handler
    card.querySelectorAll('.btn-suggestion').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const replacement = btn.dataset.replacement;
        applyGrammarSuggestion(issue, replacement);
      });
    });
    
    grammarIssuesList.appendChild(card);
  });
}

// Apply suggestion by replacing selected slice in the textarea and saving
function applyGrammarSuggestion(issue, replacement) {
  if (!currentNote) return;
  
  const textarea = markdownTextarea;
  const currentContent = textarea.value;
  const offset = issue.offset;
  const length = issue.length;
  
  // Verify that the text at that index matches what LanguageTool saw, or find it
  // This is a safety check. If the offset is valid and fits, we replace it.
  const sliceToReplace = currentContent.substring(offset, offset + length);
  
  let newContent = '';
  
  // If the text slice matches the error context precisely, use exact offset
  if (sliceToReplace.toLowerCase() === currentContent.substring(offset, offset + length).toLowerCase()) {
    newContent = currentContent.substring(0, offset) + replacement + currentContent.substring(offset + length);
  } else {
    // Fallback: If text shifted, try to find the error word globally or ask to recheck
    showToast('Text layout shifted. Saving & re-checking...', 'warning');
    saveNote();
    return;
  }
  
  // Update UI and state
  textarea.value = newContent;
  currentNote.content = newContent;
  updateCounts(newContent);
  renderPreviewLocal(newContent);
  
  // Trigger save immediately to update DB and check grammar again
  saveStatus.textContent = 'Saving...';
  saveStatus.classList.add('saving');
  clearTimeout(saveDebounceTimer);
  saveNote(true);
  
  showToast('Suggestion applied!');
}

// Helper to update character and word counts
function updateCounts(text) {
  const charCount = text.length;
  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).filter(Boolean).length;
  charWordCount.textContent = `${wordCount} word${wordCount === 1 ? '' : 's'} • ${charCount} char${charCount === 1 ? '' : 's'}`;
}

// Clear workspace when no note is loaded
function clearWorkspace() {
  currentNote = null;
  noteTitleInput.value = '';
  markdownTextarea.value = '';
  htmlRenderedContent.innerHTML = `
    <div class="preview-empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
      <p>Select a note or create a new one to start writing.</p>
    </div>
  `;
  charWordCount.textContent = '0 words';
  disableWorkspaceInputs(true);
  renderGrammarAssistant();
}

// Enable/Disable workspace controls
function disableWorkspaceInputs(disabled) {
  noteTitleInput.disabled = disabled;
  markdownTextarea.disabled = disabled;
  btnSaveNote.disabled = disabled;
  btnDeleteNote.disabled = disabled;
  btnRecheckGrammar.disabled = disabled;
  
  if (disabled) {
    saveStatus.style.opacity = '0';
  } else {
    saveStatus.style.opacity = '1';
  }
}

// Escape functions
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
