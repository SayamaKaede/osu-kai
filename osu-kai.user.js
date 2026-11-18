// ==UserScript==
// @name         osu! Kai
// @namespace    https://github.com/SayamaKaede
// @version      0.0.1
// @description  フレンドページで相互・片思いの絞り込みと前回からの変化を表示し、譜面ページで自分のプレイ回数とタイトル・アーティストの別の表記を表示する。左下の「Kai」からオプションを開く
// @author       SayamaKaede
// @homepageURL  https://github.com/SayamaKaede/osu-kai
// @updateURL    https://raw.githubusercontent.com/SayamaKaede/osu-kai/main/osu-kai.user.js
// @downloadURL  https://raw.githubusercontent.com/SayamaKaede/osu-kai/main/osu-kai.user.js
// @match        https://osu.ppy.sh/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const page = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;

    const english = () => String(page.currentLocale ?? document.documentElement.lang).startsWith('en');

    const WORDS = {
        ja: {
            all: '全員',
            mutual: '相互',
            oneWay: '片思い',
            becameMutual: '相互になった',
            lostMutual: '相互じゃなくなった',
            added: '追加した',
            renamed: '名前が変わった',
            removed: 'いなくなった',
            record: '既読にする',
            people: (label, count) => `${label} ${count}人`,
            separator: '、',
            more: (rest) => ` ほか${rest}人`,
            sinceTip: (when) => `${when} 以降`,
            firstTime: '前回の記録がないので、変化は次回から表示されます。',
            notLoggedIn: 'ログインしていないので、フレンド一覧を取得できません。',
            missing: (what) => `ページに ${what} がありません。osu! 側の作りが変わった可能性があります。`,
            noCards: 'ページ側のカードが見つからなかったので、絞り込みは動作しません。osu! 側の作りが変わった可能性があります。',
            emptyFilter: '該当する人は、いま表示されているカードの中にいません。検索欄と、公式の絞り込み（Relationship や Online/Offline）も確認してください。',
            playcount: '自分のプレイ回数',
            playcountMissing: (reason) => `自分のプレイ回数を取得できません: ${reason}`,
            alternateMissing: (reason) => `別の表記を取得できません: ${reason}`,
            search: '名前で検索',
            options: 'osu! Kai のオプション',
            dateFormat: '日付の形式',
            friendsPage: 'フレンドページ',
            friendsFeature: 'フレンド機能の拡張',
            beatmapPage: '譜面ページ',
            playcountFeature: '自分のプレイ回数を表示',
            alternateFeature: 'タイトル・アーティストのもう片方の言語をマウスを合わせて表示',
            back: '戻る',
            close: '閉じる',
        },
        en: {
            all: 'All',
            mutual: 'Mutual',
            oneWay: 'Non-mutual',
            becameMutual: 'Became mutual',
            lostMutual: 'No longer mutual',
            added: 'Added',
            renamed: 'Renamed',
            removed: 'Removed',
            record: 'Mark as read',
            people: (label, count) => `${label}: ${count}`,
            separator: ', ',
            more: (rest) => ` and ${rest} more`,
            sinceTip: (when) => `Since ${when}`,
            firstTime: 'No previous record yet. Changes will appear from your next visit.',
            notLoggedIn: 'You are not logged in, so the friend list cannot be read.',
            missing: (what) => `The page has no ${what}. The osu! website may have changed.`,
            noCards: 'The friend cards on the page were not found, so filtering does not work. The osu! website may have changed.',
            emptyFilter: 'No one here matches. Check the search box and the official filters (Relationship and Online/Offline) too.',
            playcount: 'Personal Plays',
            playcountMissing: (reason) => `Personal Plays unavailable: ${reason}`,
            alternateMissing: (reason) => `Alternate spelling unavailable: ${reason}`,
            search: 'Search by name',
            options: 'osu! Kai options',
            dateFormat: 'Date format',
            friendsPage: 'Friends page',
            friendsFeature: 'Extended friend features',
            beatmapPage: 'Beatmap page',
            playcountFeature: 'Show Personal Plays',
            alternateFeature: 'Show title and artist in the other language on hover',
            back: 'Back',
            close: 'Close',
        },
    };

    const words = () => WORDS[english() ? 'en' : 'ja'];

    const hasGM = typeof GM_getValue === 'function';

    const store = {
        get(key, fallback) {
            const raw = hasGM ? GM_getValue(key, null) : localStorage.getItem(key);
            if (raw == null) return fallback;
            try {
                return JSON.parse(raw);
            } catch {
                return fallback;
            }
        },
        set(key, value) {
            const raw = JSON.stringify(value);
            if (hasGM) GM_setValue(key, raw);
            else localStorage.setItem(key, raw);
        },
        remove(key) {
            if (hasGM) GM_deleteValue(key);
            else localStorage.removeItem(key);
        },
    };

    const KEY = {
        snapshot: 'osu-friends:snapshot',
        options: 'osu-kai:options',
    };

    const DATE_FORMATS = ['yyyy/mm/dd', 'mm/dd/yyyy', 'dd/mm/yyyy', 'yyyy-mm-dd'];

    const DEFAULT_OPTIONS = { dateFormat: DATE_FORMATS[0], friends: true, playcount: true, alternate: true };

    function options() {
        return { ...DEFAULT_OPTIONS, ...store.get(KEY.options, {}) };
    }

    function setOption(key, value) {
        store.set(KEY.options, { ...store.get(KEY.options, {}), [key]: value });
    }

    function formatDate(iso, format = options().dateFormat) {
        const date = new Date(iso);
        const pad = (n) => String(n).padStart(2, '0');
        const parts = { yyyy: String(date.getFullYear()), mm: pad(date.getMonth() + 1), dd: pad(date.getDate()) };
        const day = (DATE_FORMATS.includes(format) ? format : DATE_FORMATS[0]).replace(/yyyy|mm|dd/g, (token) => parts[token]);

        return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    const LEGACY_KEYS = ['osu-friends:config', 'osu-friends:token', 'osu-friends:state'];

    class Trouble extends Error {}

    function readFriends() {
        const currentUser = page.currentUser;

        if (currentUser?.id == null) throw new Trouble(words().notLoggedIn);

        const relations = currentUser.friends;

        if (!Array.isArray(relations)) throw new Trouble(words().missing('currentUser.friends'));

        if (relations.length > 0 && !('mutual' in relations[0])) {
            throw new Trouble(words().missing('currentUser.friends[].mutual'));
        }

        const element = document.getElementById('json-users');

        if (!element) throw new Trouble(words().missing('#json-users'));

        const users = new Map(JSON.parse(element.textContent).map((user) => [user.id, user]));

        return relations
            .filter((relation) => relation.relation_type == null || relation.relation_type === 'friend')
            .map((relation) => {
                const user = users.get(relation.target_id) ?? {};

                return {
                    id: relation.target_id,
                    mutual: Boolean(relation.mutual),
                    username: user.username ?? String(relation.target_id),
                    country_code: user.country_code ?? null,
                };
            })
            .sort((a, b) => a.username.localeCompare(b.username, 'ja'));
    }

    function compare(previous, people) {
        if (!previous) return { taken_at: null, becameMutual: [], lostMutual: [], added: [], renamed: [], removed: [] };

        const before = new Map(previous.friends.map((person) => [person.id, person]));
        const now = new Set(people.map((person) => person.id));

        const isRealName = (person) => person.username !== String(person.id);

        return {
            taken_at: previous.taken_at,
            becameMutual: people.filter((p) => before.has(p.id) && p.mutual && !before.get(p.id).mutual),
            lostMutual: people.filter((p) => before.has(p.id) && !p.mutual && before.get(p.id).mutual),
            added: people.filter((p) => !before.has(p.id)),
            renamed: people
                .filter((p) => before.has(p.id) && isRealName(p) && isRealName(before.get(p.id)) && p.username !== before.get(p.id).username)
                .map((p) => ({ ...p, previous_username: before.get(p.id).username })),
            removed: previous.friends.filter((p) => !now.has(p.id)),
        };
    }

    function changeCount(changes) {
        return changes.becameMutual.length + changes.lostMutual.length + changes.added.length + changes.renamed.length + changes.removed.length;
    }

    function findCards() {
        const container = document.querySelector('.user-cards');
        const cards = new Map();

        if (!container) return { container: null, cards };

        for (const card of container.children) {
            const link = card.querySelector('a[href*="/users/"]');
            const found = link?.getAttribute('href')?.match(/\/users\/(\d+)/);

            if (found) cards.set(Number(found[1]), card);
        }

        return { container, cards };
    }

    const CSS = `
.kai-panel {
  background: hsl(var(--hsl-b5)); padding: 12px 10px;
  color: hsl(var(--hsl-c1)); font-size: 13px; line-height: 1.7;
}
@media (min-width: 900px) { .kai-panel { padding: 12px 50px; } }
.kai-search {
  display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px; width: 200px;
  background: hsl(var(--hsl-b6)); border: 1px solid hsla(var(--hsl-c1), .08); border-radius: 8px; color: hsl(var(--hsl-c2));
}
.kai-search:focus-within { border-color: hsl(var(--hsl-pink-1)); }
.kai-search input {
  flex: 1; min-width: 0; height: 100%; padding: 0; background: none; border: none; outline: none;
  color: hsl(var(--hsl-c1)); font: inherit;
}
.kai-search input::placeholder { color: hsl(var(--hsl-c2)); opacity: .7; }
.kai-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.kai-row + .kai-row, .kai-row + .kai-note, .kai-note + .kai-row { margin-top: 8px; }
.kai-group { display: flex; gap: 2px; align-items: center; }
.kai-sep { width: 1px; align-self: stretch; margin: 4px 8px; background: hsl(var(--hsl-b3)); }
.kai-spacer { flex: 1; }
.kai-icon {
  display: inline-flex; align-items: center; gap: 4px; height: 32px; min-width: 32px; padding: 0 8px;
  background: none; border: none; border-radius: 8px; color: hsl(var(--hsl-c2)); font: inherit; cursor: pointer;
}
.kai-icon:focus-visible, .kai-options-button:focus-visible, .kai-back:focus-visible {
  outline: 2px solid hsl(var(--hsl-pink-1)); outline-offset: 2px;
}
.kai-link:focus-visible { outline: 2px solid hsl(var(--hsl-pink-1)); outline-offset: -2px; }
.kai-icon:hover { background: hsl(var(--hsl-b4)); color: hsl(var(--hsl-c1)); }
.kai-icon[aria-pressed="true"] { background: hsl(var(--hsl-b3)); color: hsl(var(--hsl-l1)); }
.kai-icon:disabled { opacity: .35; cursor: default; background: none; color: hsl(var(--hsl-c2)); }
.kai-icon .fas { font-size: 14px; width: 16px; text-align: center; }
.kai-num { font-size: 12px; font-variant-numeric: tabular-nums; }
.kai-note { color: hsl(var(--hsl-c2)); }
.kai-warn { color: hsl(var(--hsl-red-light, 0 100% 70%)); }
.kai-changes { display: flex; flex-wrap: wrap; gap: 4px 16px; }
.kai-change .fas { margin-right: 8px; }
.kai-options-button {
  position: fixed; left: 24px; bottom: 24px; z-index: 9999;
  display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 16px;
  background: hsl(var(--hsl-b5)); border: 1px solid hsla(var(--hsl-c1), .08); border-radius: 18px;
  color: hsl(var(--hsl-pink-1)); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background-color .15s ease-out;
}
.kai-options-button:hover { background: hsl(var(--hsl-b4)); }
.kai-options {
  position: fixed; left: 24px; bottom: 72px; z-index: 10000; width: 300px; max-width: calc(100vw - 48px); overflow: hidden;
  background: hsl(var(--hsl-b4)); border: 1px solid hsla(var(--hsl-c1), .08); border-radius: 12px;
  color: hsl(var(--hsl-c1)); font-size: 13px; line-height: 1.6;
}
.kai-options__head {
  display: flex; align-items: center; gap: 4px; height: 44px; padding: 0 8px;
  border-bottom: 1px solid hsla(var(--hsl-c1), .08); font-size: 14px; font-weight: 600;
}
.kai-back {
  display: inline-flex; align-items: center; gap: 4px; flex: none; height: 28px; padding: 0 8px 0 4px;
  background: none; border: none; border-radius: 8px; color: hsl(var(--hsl-c2)); font: inherit; font-size: 13px; font-weight: 400; cursor: pointer;
  transition: background-color .15s ease-out, color .15s ease-out;
}
.kai-back[hidden] { display: none; }
.kai-back:hover { background: hsl(var(--hsl-b5)); color: hsl(var(--hsl-c1)); }
.kai-back .fas { font-size: 11px; width: 12px; text-align: center; }
.kai-stack__titles { position: relative; flex: 1; align-self: stretch; min-width: 0; }
.kai-stack__title {
  position: absolute; left: 8px; right: 0; top: 50%; transform: translateY(-50%); transform-origin: left center; pointer-events: none;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.kai-stack { position: relative; overflow: hidden; }
.kai-stack__page { position: absolute; left: 0; right: 0; top: 0; padding: 4px 16px 16px; background: hsl(var(--hsl-b4)); }
.kai-stack__page--top { box-shadow: -8px 0 24px -12px rgb(0 0 0 / .4); }
.kai-stack__shade { position: absolute; inset: 0; background: #000; opacity: 0; pointer-events: none; }
.kai-options__section { margin: 12px 0 4px; font-size: 12px; font-weight: 600; color: hsl(var(--hsl-c2)); }
.kai-options__box { overflow: hidden; background: hsl(var(--hsl-b5)); border-radius: 8px; }
.kai-options__box > * + * { border-top: 1px solid hsla(var(--hsl-c1), .08); }
.kai-options__box:first-child { margin-top: 12px; }
.kai-toggle { display: grid; grid-template-columns: 1fr auto; column-gap: 16px; align-items: center; padding: 8px 12px; cursor: pointer; }
.kai-link {
  display: grid; grid-template-columns: 1fr auto 12px; column-gap: 8px; align-items: center; width: 100%; padding: 8px 12px;
  background: none; border: none; color: inherit; font: inherit; text-align: left; cursor: pointer;
  transition: background-color .15s ease-out;
}
.kai-link:hover:not(:disabled) { background: hsla(var(--hsl-c1), .04); }
.kai-link:disabled { opacity: .45; cursor: default; }
.kai-link__detail { color: hsl(var(--hsl-c2)); font-variant-numeric: tabular-nums; }
.kai-link .fas { font-size: 11px; color: hsl(var(--hsl-c2)); text-align: center; }
.kai-link .fa-check { color: hsl(var(--hsl-pink-1)); }
.kai-link[aria-pressed="false"] .fa-check { visibility: hidden; }
.kai-switch {
  position: relative; flex: none; width: 32px; height: 18px; padding: 0; border: 0; border-radius: 9px; cursor: pointer;
  background: hsla(var(--hsl-c1), .2);
}
.kai-switch i {
  position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 7px;
  background: hsl(var(--hsl-c1)); will-change: transform, width;
}
.kai-switch:focus-visible { outline: 2px solid hsl(var(--hsl-pink-1)); outline-offset: 2px; }
`;

    function ensureStyle() {
        if (!document.getElementById('kai-style')) {
            document.head.append(Object.assign(document.createElement('style'), { id: 'kai-style', textContent: CSS }));
        }
    }

    function panel() {
        ensureStyle();

        const element = document.createElement('div');
        element.className = 'kai-panel';

        const list = document.querySelector('.user-list');
        const toolbar = document.querySelector('.user-list__toolbar');

        if (toolbar) toolbar.before(element);
        else if (list) list.prepend(element);
        else document.querySelector('.osu-page')?.prepend(element);

        return element;
    }

    function row(...children) {
        const element = document.createElement('div');
        element.className = 'kai-row';
        element.append(...children);
        return element;
    }

    function text(content, className = '') {
        const element = document.createElement('div');
        element.className = className;
        element.textContent = content;
        return element;
    }

    function iconButton(icon, label, count, onClick) {
        const element = document.createElement('button');
        element.className = 'kai-icon';
        element.type = 'button';
        element.title = label;
        element.setAttribute('aria-label', count == null ? label : words().people(label, count));
        element.onclick = onClick;

        const glyph = document.createElement('span');
        glyph.className = `fas ${icon}`;
        element.append(glyph);

        if (count != null) {
            const number = document.createElement('span');
            number.className = 'kai-num';
            number.textContent = String(count);
            element.append(number);
        }

        return element;
    }

    function nameSpans(people, name, since, limit = 10) {
        const w = words();
        const nodes = [];

        people.slice(0, limit).forEach((person, index) => {
            if (index > 0) nodes.push(w.separator);

            const element = Object.assign(document.createElement('span'), { className: 'kai-name', textContent: name(person) });
            element.dataset.since = since;
            element.title = w.sinceTip(formatDate(since));
            nodes.push(element);
        });

        if (people.length > limit) nodes.push(w.more(people.length - limit));

        return nodes;
    }

    function refreshDates() {
        for (const element of document.querySelectorAll('.kai-name[data-since]')) {
            element.title = words().sinceTip(formatDate(element.dataset.since));
        }
    }

    function show(host, people, changes, cards) {
        host.textContent = '';

        const mutual = people.filter((person) => person.mutual);
        const oneWay = people.filter((person) => !person.mutual);

        const w = words();

        const views = [
            [['fa-users', w.all, people], ['fa-user-friends', w.mutual, mutual], ['fa-user', w.oneWay, oneWay]],
            [
                ['fa-user-check', w.becameMutual, changes.becameMutual],
                ['fa-user-times', w.lostMutual, changes.lostMutual],
                ['fa-user-plus', w.added, changes.added],
                ['fa-user-edit', w.renamed, changes.renamed],
            ],
        ];

        const record = () => {
            store.set(KEY.snapshot, { taken_at: new Date().toISOString(), friends: people });
            location.reload();
        };

        const bar = row();
        const filterButtons = [];
        let everyone = null;

        const select = (element, group) => {
            for (const other of filterButtons) other.setAttribute('aria-pressed', 'false');
            element.setAttribute('aria-pressed', 'true');
            cards.apply(element === everyone ? null : group);
        };

        views.forEach((set, index) => {
            if (index > 0) bar.append(Object.assign(document.createElement('span'), { className: 'kai-sep' }));

            const group = Object.assign(document.createElement('div'), { className: 'kai-group' });

            for (const [icon, label, members] of set) {
                const element = iconButton(icon, label, members.length, () => {
                    if (element.getAttribute('aria-pressed') === 'true' && element !== everyone) select(everyone, people);
                    else select(element, members);
                });

                const isEveryone = members === people;
                if (isEveryone) everyone = element;
                element.disabled = members.length === 0 && !isEveryone;
                element.setAttribute('aria-pressed', String(isEveryone));
                filterButtons.push(element);
                group.append(element);
            }

            if (index === views.length - 1) group.append(iconButton('fa-save', w.record, null, record));

            bar.append(group);
        });

        const search = Object.assign(document.createElement('label'), { className: 'kai-search' });
        const input = Object.assign(document.createElement('input'), { type: 'search', placeholder: w.search });
        input.setAttribute('aria-label', w.search);
        input.oninput = () => cards.search(input.value);
        input.onkeydown = (event) => {
            if (event.key !== 'Escape') return;
            input.value = '';
            cards.search('');
        };
        search.append(Object.assign(document.createElement('span'), { className: 'fas fa-search' }), input);

        bar.append(
            Object.assign(document.createElement('span'), { className: 'kai-spacer' }),
            search,
        );

        host.append(bar);

        if (changes.taken_at === null) {
            host.append(text(w.firstTime, 'kai-note'));
        } else if (changeCount(changes) > 0) {
            const line = text('', 'kai-note kai-changes');
            const groups = [
                ['fa-user-check', w.becameMutual, changes.becameMutual],
                ['fa-user-times', w.lostMutual, changes.lostMutual],
                ['fa-user-plus', w.added, changes.added],
                ['fa-user-edit', w.renamed, changes.renamed, (person) => `${person.previous_username} → ${person.username}`],
                ['fa-user-minus', w.removed, changes.removed],
            ];

            for (const [icon, label, group, name = (person) => person.username] of groups) {
                if (group.length === 0) continue;

                const item = Object.assign(document.createElement('span'), { className: 'kai-change' });
                const glyph = Object.assign(document.createElement('span'), { className: `fas ${icon}`, title: label });
                glyph.setAttribute('aria-label', label);

                item.append(glyph, ...nameSpans(group, name, changes.taken_at));
                line.append(item);
            }

            host.append(line);
        }

        host.append(cards.notice);

        if (!cards.container) {
            host.append(text(w.noCards, 'kai-warn'));
        }
    }

    let cardObserver = null;

    function cardFilter(people) {
        let found = findCards();
        let showing = null;
        let query = '';

        const usernames = new Map(people.map((person) => [person.id, person.username.toLowerCase()]));

        const notice = Object.assign(document.createElement('div'), {
            className: 'kai-note',
            textContent: words().emptyFilter,
            hidden: true,
        });

        const paint = () => {
            let visible = 0;

            for (const [id, card] of found.cards) {
                const show = (showing === null || showing.has(id)) && (query === '' || (usernames.get(id) ?? '').includes(query));
                card.style.display = show ? '' : 'none';
                if (show) visible += 1;
            }

            notice.hidden = (showing === null && query === '') || visible > 0;
        };

        cardObserver?.disconnect();
        cardObserver = null;

        if (found.container) {
            cardObserver = new MutationObserver(() => {
                found = findCards();
                paint();
            });

            cardObserver.observe(found.container, { childList: true });
        }

        return {
            container: found.container,
            notice,
            apply(people) {
                showing = people === null ? null : new Set(people.map((person) => person.id));
                paint();
            },
            search(text) {
                query = text.trim().toLowerCase();
                paint();
            },
        };
    }

    function waitFor(selector, timeout = 8000) {
        return new Promise((resolve) => {
            if (document.querySelector(selector)) return resolve(true);

            const observer = new MutationObserver(() => {
                if (!document.querySelector(selector)) return;
                observer.disconnect();
                resolve(true);
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                resolve(false);
            }, timeout);
        });
    }

    async function run() {
        await waitFor('.user-list');

        if (!options().friends) return;

        const host = panel();

        for (const key of LEGACY_KEYS) store.remove(key);

        try {
            const people = readFriends();
            const previous = store.get(KEY.snapshot, null);
            const changes = compare(previous, people);

            if (previous === null || changeCount(changes) === 0) {
                store.set(KEY.snapshot, { taken_at: new Date().toISOString(), friends: people });
            }

            await waitFor('.user-cards');

            if (!host.isConnected) return;

            show(host, people, changes, cardFilter(people));
        } catch (trouble) {
            host.textContent = '';
            host.append(text(String(trouble.message ?? trouble), 'kai-warn'));
        }
    }

    let playcountObserver = null;
    let playcountHover = null;
    let playcountPaint = null;

    function readPlaycounts() {
        const element = document.getElementById('json-beatmapset');

        if (!element) throw new Trouble(words().missing('#json-beatmapset'));

        const beatmaps = JSON.parse(element.textContent).beatmaps ?? [];

        if (beatmaps.length > 0 && !('current_user_playcount' in beatmaps[0])) {
            throw new Trouble(words().missing('#json-beatmapset .beatmaps[].current_user_playcount'));
        }

        return new Map(beatmaps.map((beatmap) => [beatmap.id, beatmap.current_user_playcount ?? 0]));
    }

    function pickerBeatmapId(link) {
        const found = link?.getAttribute('href')?.match(/#\w+\/(\d+)/);
        return found ? Number(found[1]) : null;
    }

    async function runPlaycount() {
        if (page.currentUser?.id == null) return;

        if (!(await waitFor('.beatmapset-header__beatmap-picker-box .beatmapset-header__value'))) return;

        if (!options().playcount) return;

        ensureStyle();

        const value = document.createElement('span');
        value.className = 'beatmapset-header__value kai-playcount';

        const icon = document.createElement('span');
        icon.className = 'beatmapset-header__value-icon';
        icon.append(Object.assign(document.createElement('span'), { className: 'fas fa-user' }));

        const number = document.createElement('span');
        number.className = 'beatmapset-header__value-name';

        value.append(icon, number);

        const w = words();

        let counts;

        try {
            counts = readPlaycounts();
        } catch (trouble) {
            number.textContent = '?';
            value.title = w.playcountMissing(trouble.message);
            document.querySelector('.beatmapset-header__beatmap-picker-box .beatmapset-header__value').after(value);
            return;
        }

        const paint = () => {
            const active = document.querySelector('.beatmapset-beatmap-picker__beatmap--active');
            const id = playcountHover ?? pickerBeatmapId(active);
            const count = id == null ? null : counts.get(id);
            const label = count == null ? '-' : count.toLocaleString();

            if (number.textContent !== label) number.textContent = label;
            value.title = w.playcount;

            if (!value.isConnected) {
                document.querySelector('.beatmapset-header__beatmap-picker-box .beatmapset-header__value')?.after(value);
            }
        };

        paint();
        playcountPaint = paint;

        playcountObserver?.disconnect();
        playcountObserver = new MutationObserver(paint);
        playcountObserver.observe(document.querySelector('.beatmapset-header') ?? document.body, {
            subtree: true, childList: true, attributes: true, attributeFilter: ['class'],
        });
    }

    document.addEventListener('mouseover', (event) => {
        const link = event.target.closest?.('.beatmapset-beatmap-picker__beatmap');
        const id = link ? pickerBeatmapId(link) : null;

        if (id === playcountHover) return;
        playcountHover = id;
        playcountPaint?.();
    });

    const ALTERNATE_FIELDS = [
        ['.beatmapset-header__details-text--title > a', 'title', 'title_unicode'],
        ['.beatmapset-header__details-text--artist > a', 'artist', 'artist_unicode'],
    ];

    let beatmapsetCache = null;

    function readBeatmapset() {
        const element = document.getElementById('json-beatmapset');

        if (!element) throw new Trouble(words().missing('#json-beatmapset'));

        if (beatmapsetCache?.element !== element) {
            beatmapsetCache = { element, data: JSON.parse(element.textContent) };
        }

        return beatmapsetCache.data;
    }

    document.addEventListener('mouseover', (event) => {
        if (!/^\/beatmapsets\/\d+/.test(location.pathname) || !options().alternate) return;

        for (const [selector, romanized, original] of ALTERNATE_FIELDS) {
            const link = event.target.closest?.(selector);

            if (!link) continue;

            let tip = '';

            try {
                const set = readBeatmapset();

                if (!(original in set)) throw new Trouble(words().missing(`#json-beatmapset .${original}`));

                const shown = link.textContent.trim();

                if (shown === set[romanized]) tip = set[original] ?? '';
                else if (shown === set[original]) tip = set[romanized] ?? '';

                if (tip === shown) tip = '';
            } catch (trouble) {
                tip = words().alternateMissing(trouble.message ?? String(trouble));
            }

            if (tip) link.title = tip;
            else link.removeAttribute('title');

            return;
        }
    }, true);

    // Switch motion based on "Toggle switch" from designbookmark.com
    function springSwitch(on, label, onChange) {
        const TRAVEL = 14;
        const KNOB = 14;
        const STRETCH = 6;

        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'kai-switch';
        element.setAttribute('role', 'switch');
        element.setAttribute('aria-checked', String(on));
        element.setAttribute('aria-label', label);

        const knob = document.createElement('i');
        element.append(knob);

        const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const spring = (x, k, c) => ({ x, v: 0, t: x, k, c: reduce ? 2 * Math.sqrt(k) : c });
        const position = spring(on ? 1 : 0, 320, 18);
        const stretch = spring(0, 300, 20);

        const step = (s, dt) => {
            s.v += (-s.k * (s.x - s.t) - s.c * s.v) * dt;
            s.x += s.v * dt;
        };
        const clamp = (value) => Math.max(0, Math.min(1, value));

        const render = () => {
            const grow = clamp(stretch.x) * STRETCH;
            const x = position.x * TRAVEL;

            knob.style.width = `${(KNOB + grow).toFixed(2)}px`;
            knob.style.transform = `translateX(${(on ? x - grow * clamp(position.x) : x).toFixed(2)}px)`;
            element.style.background =
                `color-mix(in srgb, hsl(var(--hsl-pink-1)) ${(clamp(position.x) * 100).toFixed(1)}%, hsla(var(--hsl-c1), .2))`;
        };

        let frame = null;
        let last = 0;

        const loop = (now) => {
            const dt = Math.min((now - last) / 1000, 1 / 30);
            last = now;

            for (let i = 0; i < 4; i++) {
                step(position, dt / 4);
                step(stretch, dt / 4);
            }

            const settled = Math.abs(position.x - position.t) < 1e-3 && Math.abs(position.v) < 1e-3
                && Math.abs(stretch.x) < 1e-3 && Math.abs(stretch.v) < 1e-3;

            if (settled) {
                position.x = position.t;
                position.v = stretch.x = stretch.v = 0;
                frame = null;
            } else {
                frame = requestAnimationFrame(loop);
            }

            render();
        };

        element.onclick = () => {
            on = !on;
            element.setAttribute('aria-checked', String(on));
            position.t = on ? 1 : 0;
            if (!reduce) stretch.v = 60;
            onChange(on);

            if (frame === null) {
                last = performance.now();
                frame = requestAnimationFrame(loop);
            }
        };

        render();
        return element;
    }

    let closeOptions = null;

    function springEasing() {
        const u = 7.43;
        const points = [];

        for (let i = 0; i < 32; i++) {
            const t = i / 32;
            points.push((1 - (1 + u * t) * Math.exp(-u * t)).toFixed(4));
        }

        return `linear(${points.join(', ')}, 1)`;
    }

    // Stack panel motion from Kokonut UI (MIT): https://kokonutui.com/docs/navigation/stack-panel
    const STACK = { push: 420, pop: 340, height: 380, fade: 180, title: 280, parallax: 0.3, shade: 0.06 };
    const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

    function openOptions() {
        closeOptions?.();
        ensureStyle();

        const w = words();
        const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const time = (ms) => (reduce ? 0 : ms);
        const SPRING = springEasing();

        const dialog = document.createElement('div');
        dialog.className = 'kai-options';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-label', w.options);

        const back = Object.assign(document.createElement('button'), { type: 'button', className: 'kai-back', hidden: true });
        back.append(Object.assign(document.createElement('span'), { className: 'fas fa-chevron-left' }), w.back);

        const titles = Object.assign(document.createElement('div'), { className: 'kai-stack__titles' });
        const closeButton = iconButton('fa-times', w.close, null, () => closeOptions?.());
        const head = Object.assign(document.createElement('div'), { className: 'kai-options__head' });
        head.append(back, titles, closeButton);

        const body = Object.assign(document.createElement('div'), { className: 'kai-stack' });
        dialog.append(head, body);

        const section = (title) => text(title, 'kai-options__section');

        const box = (...children) => {
            const element = Object.assign(document.createElement('div'), { className: 'kai-options__box' });
            element.append(...children);
            return element;
        };

        const toggle = (key, label) => {
            const element = Object.assign(document.createElement('label'), { className: 'kai-toggle' });
            const name = Object.assign(document.createElement('span'), { textContent: label });

            const input = springSwitch(options()[key], label, (on) => {
                setOption(key, on);
                applyFeature(key, on);
                if (key === 'friends') dateRow.disabled = !on;
            });

            element.append(name, input);
            return element;
        };

        const link = (label, detail, icon) => {
            const element = Object.assign(document.createElement('button'), { type: 'button', className: 'kai-link' });
            const name = Object.assign(document.createElement('span'), { className: 'kai-link__label', textContent: label });
            const value = Object.assign(document.createElement('span'), { className: 'kai-link__detail', textContent: detail });
            const glyph = Object.assign(document.createElement('span'), { className: `fas ${icon}` });
            element.append(name, value, glyph);
            return element;
        };

        const dateRow = link(w.dateFormat, options().dateFormat, 'fa-chevron-right');
        dateRow.disabled = !options().friends;

        const root = document.createElement('div');
        root.append(
            section(w.friendsPage),
            box(toggle('friends', w.friendsFeature), dateRow),
            section(w.beatmapPage),
            box(toggle('playcount', w.playcountFeature), toggle('alternate', w.alternateFeature)),
        );

        const datePage = () => {
            const now = new Date().toISOString();
            const rows = DATE_FORMATS.map((format) => {
                const row = link(format, formatDate(now, format), 'fa-check');
                row.setAttribute('aria-pressed', String(format === options().dateFormat));
                row.onclick = () => {
                    setOption('dateFormat', format);
                    refreshDates();
                    for (const other of rows) other.setAttribute('aria-pressed', String(other === row));
                    dateRow.querySelector('.kai-link__detail').textContent = format;
                };
                return row;
            });

            const page = document.createElement('div');
            page.append(box(...rows));
            return page;
        };

        const stack = [];
        let busy = false;

        const makeTitle = (content) => {
            const element = Object.assign(document.createElement('span'), { className: 'kai-stack__title', textContent: content });
            titles.append(element);
            return element;
        };

        const makePage = (content) => {
            const page = Object.assign(document.createElement('div'), { className: 'kai-stack__page' });
            const shade = Object.assign(document.createElement('div'), { className: 'kai-stack__shade' });
            page.append(content, shade);
            body.append(page);
            return page;
        };

        const fitHeight = (page) => {
            const from = body.offsetHeight;
            const to = page.offsetHeight;

            body.style.height = `${to}px`;
            if (from !== to) body.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: time(STACK.height), easing: SPRING });
        };

        const push = (title, content, opener) => {
            if (busy) return;
            busy = true;

            const under = stack.at(-1);
            const width = body.clientWidth;
            const label = opener.querySelector('.kai-link__label');
            const page = makePage(content);
            stack.push({ title: makeTitle(title), page, opener });

            fitHeight(page);

            under.page.style.transform = `translateX(${-STACK.parallax * width}px)`;
            under.page.animate([{ transform: 'none' }, { transform: under.page.style.transform }], { duration: time(STACK.push), easing: SPRING });
            const shade = under.page.querySelector('.kai-stack__shade');
            shade.style.opacity = String(STACK.shade);
            shade.animate([{ opacity: 0 }, { opacity: STACK.shade }], { duration: time(STACK.push), easing: SPRING });

            page.classList.add('kai-stack__page--top');
            const slide = page.animate([{ transform: `translateX(${width}px)` }, { transform: 'none' }], { duration: time(STACK.push), easing: SPRING });

            const own = stack.at(-1).title;
            const from = label.getBoundingClientRect();
            const to = own.getBoundingClientRect();
            const scale = parseFloat(getComputedStyle(label).fontSize) / parseFloat(getComputedStyle(own).fontSize);
            const dx = from.left - to.left;
            const dy = from.top + from.height / 2 - (to.top + to.height / 2);
            own.animate(
                [{ transform: `translate(${dx}px, calc(-50% + ${dy}px)) scale(${scale})` }, { transform: 'translateY(-50%)' }],
                { duration: time(STACK.push), easing: SPRING },
            );

            const old = under.title;
            old.animate([{ opacity: 1, transform: 'translateY(-50%)' }, { opacity: 0, transform: 'translate(-40px, -50%)' }], { duration: time(STACK.fade), easing: EASE_OUT, fill: 'forwards' });

            back.hidden = false;
            back.animate([{ opacity: 0 }, { opacity: 1 }], { duration: time(STACK.fade) });
            back.focus({ preventScroll: true });

            slide.finished.then(() => {
                under.page.hidden = true;
                busy = false;
            });
        };

        const pop = () => {
            if (busy || stack.length < 2) return;
            busy = true;

            const top = stack.pop();
            const under = stack.at(-1);
            const width = body.clientWidth;
            const hadFocus = dialog.contains(document.activeElement);

            under.page.hidden = false;
            const shift = under.page.style.transform;
            under.page.style.transform = '';
            under.page.animate([{ transform: shift }, { transform: 'none' }], { duration: time(STACK.pop), easing: SPRING });
            const shade = under.page.querySelector('.kai-stack__shade');
            shade.style.opacity = '0';
            shade.animate([{ opacity: STACK.shade }, { opacity: 0 }], { duration: time(STACK.pop), easing: SPRING });

            fitHeight(under.page);

            const slide = top.page.animate([{ transform: 'none' }, { transform: `translateX(${width}px)` }], { duration: time(STACK.pop), easing: SPRING, fill: 'forwards' });

            top.title.animate([{ opacity: 1, transform: 'translateY(-50%)' }, { opacity: 0, transform: 'translate(40px, -50%)' }], { duration: time(STACK.fade), easing: EASE_OUT, fill: 'forwards' });
            under.title.getAnimations().forEach((animation) => animation.cancel());
            under.title.animate([{ opacity: 0, transform: 'translate(-24px, -50%)' }, { opacity: 1, transform: 'translateY(-50%)' }], { duration: time(STACK.title), easing: EASE_OUT });

            if (stack.length === 1) {
                back.animate([{ opacity: 1 }, { opacity: 0 }], { duration: time(STACK.fade) }).finished.then(() => { back.hidden = stack.length === 1; });
            }

            slide.finished.then(() => {
                top.page.remove();
                top.title.remove();
                busy = false;
                if (hadFocus) top.opener.focus({ preventScroll: true });
            });
        };

        back.onclick = pop;
        dateRow.onclick = () => push(w.dateFormat, datePage(), dateRow);

        const outside = (event) => {
            if (!dialog.contains(event.target) && !event.target.closest?.('.kai-options-button')) closeOptions?.();
        };

        const escape = (event) => {
            if (event.key !== 'Escape') return;
            if (stack.length > 1) pop();
            else closeOptions?.();
        };

        closeOptions = () => {
            dialog.remove();
            document.removeEventListener('mousedown', outside, true);
            document.removeEventListener('keydown', escape, true);
            closeOptions = null;
        };

        document.addEventListener('mousedown', outside, true);
        document.addEventListener('keydown', escape, true);

        const rect = document.querySelector('.kai-options-button')?.getBoundingClientRect();

        if (rect?.width) {
            dialog.style.left = `${rect.left}px`;
            dialog.style.bottom = `${document.documentElement.clientHeight - rect.top + 8}px`;
        }

        document.body.append(dialog);

        stack.push({ title: makeTitle(w.options), page: makePage(root), opener: null });
        body.style.height = `${stack[0].page.offsetHeight}px`;
    }

    let expertPlusWatch = null;

    function alignOptionsButton() {
        const button = document.querySelector('.kai-options-button');

        if (!button) return;

        const anchor = document.getElementById('osu-expertplus-fab-anchor');
        const fab = anchor?.querySelector('#osu-expertplus-fab');
        const rect = fab?.getBoundingClientRect();

        if (expertPlusWatch && expertPlusWatch.anchor !== anchor) {
            expertPlusWatch.resize.disconnect();
            expertPlusWatch.anchor = anchor;
            if (anchor) expertPlusWatch.resize.observe(anchor);
        }

        if (!rect?.width) {
            button.style.left = button.style.bottom = button.style.height = button.style.borderRadius = '';
            return;
        }

        let top = rect.top;

        for (const child of anchor.children) {
            const box = child.getBoundingClientRect();
            if (box.width > 0) top = Math.min(top, box.top);
        }

        button.style.left = `${rect.left}px`;
        button.style.bottom = `${document.documentElement.clientHeight - top + 8}px`;
        button.style.height = `${rect.height}px`;
        button.style.borderRadius = `${rect.height / 2}px`;
    }

    function watchExpertPlus() {
        expertPlusWatch?.added.disconnect();
        expertPlusWatch?.resize.disconnect();

        expertPlusWatch = {
            anchor: null,
            added: new MutationObserver(alignOptionsButton),
            resize: new ResizeObserver(alignOptionsButton),
        };

        expertPlusWatch.added.observe(document.body, { childList: true });
        alignOptionsButton();
    }

    window.addEventListener('resize', alignOptionsButton);

    function placeOptionsButton() {
        if (document.querySelector('.kai-options-button')) return;

        ensureStyle();

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'kai-options-button';
        button.setAttribute('aria-label', words().options);
        button.append(Object.assign(document.createElement('span'), { className: 'fas fa-cog' }), 'Kai');
        button.onclick = () => (closeOptions ? closeOptions() : openOptions());

        document.body.append(button);
        watchExpertPlus();
    }

    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand(words().options, openOptions);
    }

    let busy = false;

    function stopFriends() {
        document.querySelector('.kai-panel')?.remove();
        cardObserver?.disconnect();
        cardObserver = null;
        for (const card of document.querySelector('.user-cards')?.children ?? []) card.style.display = '';
    }

    function stopPlaycount() {
        document.querySelector('.kai-playcount')?.remove();
        playcountObserver?.disconnect();
        playcountObserver = null;
        playcountHover = null;
        playcountPaint = null;
    }

    function applyFeature(key, on) {
        if (key === 'friends' && !on) stopFriends();
        if (key === 'playcount' && !on) stopPlaycount();
        if (on) boot();
    }

    async function boot() {
        placeOptionsButton();

        if (busy || document.querySelector('.kai-panel, .kai-playcount')) return;

        const enabled = options();
        let task = null;

        if (location.pathname.startsWith('/home/friends')) task = enabled.friends ? run : null;
        else if (/^\/beatmapsets\/\d+/.test(location.pathname)) task = enabled.playcount ? runPlaycount : null;

        if (!task) return;

        busy = true;

        try {
            await task();
        } finally {
            busy = false;
        }
    }

    document.addEventListener('turbo:before-cache', () => {
        stopFriends();
        stopPlaycount();
        document.querySelector('.kai-options-button')?.remove();
        closeOptions?.();
    });

    document.addEventListener('turbo:load', boot);

    boot();
})();
