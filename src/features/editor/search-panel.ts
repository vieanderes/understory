import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  SearchQuery,
  selectMatches,
  setSearchQuery,
} from '@codemirror/search';
import { runScopeHandlers, type EditorView, type Panel, type ViewUpdate } from '@codemirror/view';

/*
 * The online test's find and replace, in rows: what to find and the moves through it,
 * what to put instead, and the options. CodeMirror's own panel is one long run of controls
 * that wraps wherever the width runs out, so an option can land beside the replace
 * field. The commands and the query are CodeMirror's; only the layout is ours.
 */

type Attrs = Record<string, string>;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

export function createSearchPanel(view: EditorView): Panel {
  const phrase = (text: string) => view.state.phrase(text);
  let query = getSearchQuery(view.state);

  const field = (name: string, label: string, value: string) => {
    const input = el('input', {
      class: 'cm-textfield',
      name,
      placeholder: label,
      'aria-label': label,
      autocomplete: 'off',
      spellcheck: 'false',
      form: '',
    });
    input.value = value;
    return input;
  };
  const option = (name: string, label: string, checked: boolean) => {
    const input = el('input', { type: 'checkbox', name, form: '' });
    input.checked = checked;
    return { input, label: el('label', {}, input, label) };
  };
  const button = (name: string, label: string, run: () => void) => {
    const node = el('button', { class: 'cm-button', name, type: 'button' }, label);
    node.addEventListener('click', run);
    return node;
  };

  const searchField = field('search', phrase('Find'), query.search);
  searchField.setAttribute('main-field', 'true');
  const replaceField = field('replace', phrase('Replace'), query.replace);
  const caseOption = option('case', phrase('match case'), query.caseSensitive);
  const reOption = option('re', phrase('regexp'), query.regexp);
  const wordOption = option('word', phrase('by word'), query.wholeWord);

  function commit() {
    const next = new SearchQuery({
      search: searchField.value,
      caseSensitive: caseOption.input.checked,
      regexp: reOption.input.checked,
      wholeWord: wordOption.input.checked,
      replace: replaceField.value,
    });
    if (next.eq(query)) return;
    query = next;
    view.dispatch({ effects: setSearchQuery.of(next) });
  }

  for (const input of [searchField, replaceField]) {
    input.addEventListener('input', commit);
  }
  for (const { input } of [caseOption, reOption, wordOption]) {
    input.addEventListener('change', commit);
  }

  const findRow = el(
    'div',
    { class: 'cm-searchRow' },
    searchField,
    el(
      'div',
      { class: 'cm-searchControls' },
      button('prev', phrase('previous'), () => findPrevious(view)),
      button('next', phrase('next'), () => findNext(view)),
      button('select', phrase('all'), () => selectMatches(view)),
    ),
  );
  const replaceRow = el(
    'div',
    { class: 'cm-searchRow' },
    replaceField,
    el(
      'div',
      { class: 'cm-searchControls' },
      button('replace', phrase('replace'), () => replaceNext(view)),
      button('replaceAll', phrase('replace all'), () => replaceAll(view)),
    ),
  );
  const options = el(
    'div',
    { class: 'cm-searchOptions' },
    caseOption.label,
    reOption.label,
    wordOption.label,
  );
  const close = el('button', { name: 'close', type: 'button', 'aria-label': phrase('close') });
  close.addEventListener('click', () => closeSearchPanel(view));

  const dom = el(
    'div',
    { class: 'cm-search', role: 'search' },
    findRow,
    ...(view.state.readOnly ? [] : [replaceRow]),
    options,
    close,
  );
  dom.addEventListener('keydown', (event) => {
    // Escape, Mod-g and the rest of the search keys, as in CodeMirror's own panel.
    if (runScopeHandlers(view, event, 'search-panel')) {
      event.preventDefault();
    } else if (event.key === 'Enter' && event.target === searchField) {
      event.preventDefault();
      (event.shiftKey ? findPrevious : findNext)(view);
    } else if (event.key === 'Enter' && event.target === replaceField) {
      event.preventDefault();
      replaceNext(view);
    }
  });

  return {
    dom,
    top: true,
    mount: () => searchField.select(),
    // Mod-f with a word selected, or Vim's `/`, sets the query from outside.
    update(update: ViewUpdate) {
      for (const tr of update.transactions) {
        for (const effect of tr.effects) {
          if (!effect.is(setSearchQuery) || effect.value.eq(query)) continue;
          query = effect.value;
          searchField.value = query.search;
          replaceField.value = query.replace;
          caseOption.input.checked = query.caseSensitive;
          reOption.input.checked = query.regexp;
          wordOption.input.checked = query.wholeWord;
        }
      }
    },
  };
}
