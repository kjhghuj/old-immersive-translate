"use strict";

/**
 * This mark cannot contain words, like <customskipword>12</customskipword>34
 *
 * Google will reorder as <customskipword>1234</customskipword>
 *
 * Under certain circumstances，Google broken the translation, returned startMark0 in some cases
 * */
const startMark = '@%';
const endMark = '#$';
const startMark0 = '@ %';
const endMark0 = '# $';

let currentIndex;
let compressionMap;

/**
 *  Convert matching keywords to a string of special numbers to skip translation before sending to the translation engine.
 *
 *  For English words, ignore case when matching.
 *
 *  But for the word "app" , We don't want to "Happy" also matched.
 *
 *  So we match only isolated words, by checking the two characters before and after the keyword.
 *
 *  But this will also cause this method to not work for Chinese, Burmese and other languages without spaces.
 * */
function filterKeywordsInText(textContext) {
    let customDictionary = twpConfig.get("customDictionary")
    if (customDictionary.size > 0) {
        // reordering , we want to match the keyword "Spring Boot" first then the keyword "Spring"
        customDictionary = new Map([...customDictionary.entries()].sort((a, b) => String(b[0]).length - String(a[0]).length))
        for (let keyWord of customDictionary.keys()) {
            while (true) {
                let index = textContext.toLowerCase().indexOf(keyWord)
                if (index === -1) {
                    break
                } else {
                    textContext = removeExtraDelimiter(textContext)
                    let previousIndex = index - 1
                    let nextIndex = index + keyWord.length
                    let previousChar = previousIndex === -1 ? '\n' : textContext.charAt(previousIndex)
                    let nextChar = nextIndex === textContext.length ? '\n' : textContext.charAt(nextIndex)
                    let placeholderText = ''
                    let keyWordWithCase = textContext.substring(index, index + keyWord.length)
                    if (isPunctuationOrDelimiter(previousChar) && isPunctuationOrDelimiter(nextChar)) {
                        placeholderText = startMark + handleHitKeywords(keyWordWithCase, true) + endMark
                    } else {
                        placeholderText = '#n%o#'
                        for (let c of Array.from(keyWordWithCase)) {
                            placeholderText += c
                            placeholderText += '#n%o#'
                        }
                    }
                    let frontPart = textContext.substring(0, index)
                    let backPart = textContext.substring(index + keyWord.length)
                    textContext = frontPart + placeholderText + backPart
                }
            }
            textContext = textContext.replaceAll('#n%o#', '')
        }
    }
    return textContext
}

/**
 *  handle the keywords in translatedText, replace it if there is a custom replacement value.
 *
 *  When encountering Google Translate reordering, the original text contains our mark, etc. , we will catch these exceptions and call the text translation method to retranslate this section.
 *  */
async function handleCustomWords(translated, originalText, currentPageTranslatorService, currentTargetLanguage) {
    try {
        const customDictionary = twpConfig.get("customDictionary")
        if (customDictionary.size > 0) {
            translated = removeExtraDelimiter(translated)
            translated = translated.replaceAll(startMark0, startMark)
            translated = translated.replaceAll(endMark0, endMark)

            while (true) {
                let startIndex = translated.indexOf(startMark)
                let endIndex = translated.indexOf(endMark)
                if (startIndex === -1 && endIndex === -1) {
                    break
                } else {
                    let placeholderText = translated.substring(startIndex + startMark.length, endIndex)
                    // At this point placeholderText is actually currentIndex , the real value is in compressionMap
                    let keyWord = handleHitKeywords(placeholderText, false)
                    if (keyWord === "undefined") {
                        throw new Error("undefined")
                    }
                    let frontPart = translated.substring(0, startIndex)
                    let backPart = translated.substring(endIndex + endMark.length)
                    let customValue = customDictionary.get(keyWord.toLowerCase())
                    customValue = (customValue === '') ? keyWord : customValue
                    // Highlight custom words, make it have a space before and after it
                    frontPart = isPunctuationOrDelimiter(frontPart.charAt(frontPart.length - 1)) ? frontPart : (frontPart + ' ')
                    backPart = isPunctuationOrDelimiter(backPart.charAt(0)) ? backPart : (' ' + backPart)
                    translated = frontPart + customValue + backPart
                }
            }
        }
    } catch (e) {
        return await backgroundTranslateSingleText(currentPageTranslatorService, currentTargetLanguage, originalText)
    }

    return translated
}

/**
 *
 * True : Store the keyword in the Map and return the index
 *
 * False : Extract keywords by index
 * */
function handleHitKeywords(value, mode) {
    if (mode) {
        if (currentIndex === undefined) {
            currentIndex = 1
            compressionMap = new Map()
            compressionMap.set(currentIndex, value)
        } else {
            compressionMap.set(++currentIndex, value)
        }
        return String(currentIndex)
    } else {
        return String(compressionMap.get(Number(value)))
    }
}

/**
 * any kind of punctuation character (including international e.g. Chinese and Spanish punctuation), and spaces, newlines
 *
 * source: https://github.com/slevithan/xregexp/blob/41f4cd3fc0a8540c3c71969a0f81d1f00e9056a9/src/addons/unicode/unicode-categories.js#L142
 *
 * note: XRegExp unicode output taken from http://jsbin.com/uFiNeDOn/3/edit?js,console (see chrome console.log), then converted back to JS escaped unicode here http://rishida.net/tools/conversion/, then tested on http://regexpal.com/
 *
 * suggested by: https://stackoverflow.com/a/7578937
 *
 * added: extra characters like "$", "\uFFE5" [yen symbol], "^", "+", "=" which are not consider punctuation in the XRegExp regex (they are currency or mathmatical characters)
 *
 * added: Chinese Punctuation: \u3002|\uff1f|\uff01|\uff0c|\u3001|\uff1b|\uff1a|\u201c|\u201d|\u2018|\u2019|\uff08|\uff09|\u300a|\u300b|\u3010|\u3011|\u007e
 *
 * added: special html space symbol: &nbsp; &ensp; &emsp; &thinsp; &zwnj; &zwj; -> \u00A0|\u2002|\u2003|\u2009|\u200C|\u200D
 * @see https://stackoverflow.com/a/21396529/19616126
 * */
function isPunctuationOrDelimiter(str) {
    if (typeof str !== "string") return false
    if (str === '\n' || str === ' ') return true
    const regex = /[\$\uFFE5\^\+=`~<>{}\[\]|\u00A0|\u2002|\u2003|\u2009|\u200C|\u200D|\u3002|\uff1f|\uff01|\uff0c|\u3001|\uff1b|\uff1a|\u201c|\u201d|\u2018|\u2019|\uff08|\uff09|\u300a|\u300b|\u3010|\u3011|\u007e!-#%-\x2A,-/:;\x3F@\x5B-\x5D_\x7B}\u00A1\u00A7\u00AB\u00B6\u00B7\u00BB\u00BF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u0AF0\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E3B\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]+/g;
    return regex.test(str)
}

/**
 * Remove useless newlines, spaces inside, which may affect our semantics
 * */
function removeExtraDelimiter(textContext) {
    textContext = textContext.replaceAll('\n', ' ')
    textContext = textContext.replace(/  +/g, ' ')
    return textContext
}


function backgroundTranslateHTML(translationService, targetLanguage, sourceArray2d, dontSortResults) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            action: "translateHTML",
            translationService,
            targetLanguage,
            sourceArray2d,
            dontSortResults
        }, response => {
            resolve(response)
        })
    })
}

function backgroundTranslateText(translationService, targetLanguage, sourceArray) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            action: "translateText",
            translationService,
            targetLanguage,
            sourceArray
        }, response => {
            resolve(response)
        })
    })
}

function backgroundTranslateSingleText(translationService, targetLanguage, source) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            action: "translateSingleText",
            translationService,
            targetLanguage,
            source
        }, response => {
            resolve(response)
        })
    })
}

var pageTranslator = {}

var translatingStyle = null;

const themeColors = {
    purple: { main: "#ab47bc", border: "rgba(171, 71, 188, 0.3)" },
    orange: { main: "#ff7043", border: "rgba(255, 112, 67, 0.3)" },
    yellow: { main: "#f9a825", border: "rgba(249, 168, 37, 0.3)" },
    pink: { main: "#f06292", border: "rgba(240, 98, 146, 0.3)" },
    red: { main: "#ef5350", border: "rgba(239, 83, 80, 0.3)" },
    blue: { main: "#42a5f5", border: "rgba(66, 165, 245, 0.3)" },
    sky: { main: "#29b6f6", border: "rgba(41, 182, 246, 0.3)" },
    earth: { main: "#8d6e63", border: "rgba(141, 110, 99, 0.3)" },
    ocean: { main: "#26a69a", border: "rgba(38, 166, 154, 0.3)" },
    forest: { main: "#66bb6a", border: "rgba(102, 187, 106, 0.3)" }
};

function getSpinnerColor() {
    try {
        const theme = twpConfig.get("uiTheme") || "blue";
        return themeColors[theme] || themeColors.blue;
    } catch (e) {
        return themeColors.blue;
    }
}

function updateSpinnerStyle() {
    if (!translatingStyle) {
        translatingStyle = document.createElement("style");
        document.head.appendChild(translatingStyle);
    }
    const c = getSpinnerColor();
    translatingStyle.textContent = `
@keyframes twp-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
.twp-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    margin-left: 8px;
    vertical-align: middle;
    border: 2px solid ${c.border};
    border-top-color: ${c.main};
    border-radius: 50%;
    animation: twp-spin 0.8s linear infinite;
    opacity: 0.8;
}
`;
}

function markNodesTranslating(nodes) {
    for (const node of nodes) {
        if (node && node.parentNode) {
            const spinner = document.createElement("span");
            spinner.className = "twp-spinner";
            spinner.setAttribute("translate", "no");
            node._twpSpinner = spinner;
            node.parentNode.insertBefore(spinner, node.nextSibling);
        }
    }
}

function unmarkNodesTranslating(nodes) {
    for (const node of nodes) {
        if (node && node._twpSpinner) {
            node._twpSpinner.remove();
            delete node._twpSpinner;
        } else if (node && node.parentNode) {
            const next = node.nextSibling;
            if (next && next.classList && next.classList.contains("twp-spinner")) {
                next.remove();
            }
            const prev = node.previousSibling;
            if (prev && prev.classList && prev.classList.contains("twp-spinner")) {
                prev.remove();
            }
        }
    }
    document.querySelectorAll(".twp-spinner").forEach(s => s.remove());
}

function getTabHostName() {
    return new Promise(resolve => chrome.runtime.sendMessage({action: "getTabHostName"}, result => resolve(result)))
}

function getTabUrl() {
    return new Promise(resolve => chrome.runtime.sendMessage({action: "getTabUrl"}, result => resolve(result)))
}
Promise.all([twpConfig.onReady(), getTabUrl()])
.then(function (_) {
    const tabUrl = _[1];
    const tabUrlObj = new URL(tabUrl);
    const tabHostName = tabUrlObj.hostname;
    const tabUrlWithoutSearch = tabUrlObj.origin + tabUrlObj.pathname;
    const ctx = {
      tabUrl,
      tabHostName,
      tabUrlWithoutSearch,
      twpConfig
    }
    updateSpinnerStyle()
    const htmlTagsInlineText = ['#text', 'A', 'ABBR', 'ACRONYM', 'B', 'BDO', 'BIG', 'CITE', 'DFN', 'EM', 'I', 'LABEL', 'Q', 'S', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'U', 'TT', 'VAR']
    const htmlTagsInlineIgnore = ['BR', 'CODE', 'KBD', 'WBR'] // and input if type is submit or button, and pre depending on settings
    const htmlTagsNoTranslate = ['TITLE', 'SCRIPT', 'STYLE', 'TEXTAREA', 'SVG', 'svg'] //TODO verificar porque 'svg' é com letras minúsculas
    const specialRulesConfigs = twpConfig.get('specialRules');
    if(Array.isArray(specialRulesConfigs) && specialRulesConfigs.length > 0){
      for(const specialRuleString of specialRulesConfigs){
        // add to specialRules
        try{
          const specialRule = JSON.parse(specialRuleString);
          specialRules.unshift(specialRule);
        }catch(e){
          console.warn(`Error parsing special rule: ${specialRuleString}`)
        }
      }
    }

    if (twpConfig.get('translateTag_pre') !== 'yes') {
        htmlTagsInlineIgnore.push('PRE')
    }
    twpConfig.onChanged((name, newvalue) => {
        switch (name) {
            case "translateTag_pre":
                const index = htmlTagsInlineIgnore.indexOf('PRE')
                if (index !== -1) {
                    htmlTagsInlineIgnore.splice(index, 1)
                }
                if (newvalue !== 'yes') {
                    htmlTagsInlineIgnore.push('PRE')
                }
                break
            case "uiTheme":
                updateSpinnerStyle()
                break
        }
    })

    //TODO FOO
    twpConfig.set("targetLanguage", twpConfig.get("targetLanguages")[0])

    // Pieces are a set of nodes separated by inline tags that form a sentence or paragraph.
    let piecesToTranslate = []
    let originalTabLanguage = "und"
    let currentPageLanguage = "und"
    let pageLanguageState = "original"
    let currentTargetLanguage = twpConfig.get("targetLanguage")
    let currentPageTranslatorService = twpConfig.get("pageTranslatorService")
    let dontSortResults = twpConfig.get("dontSortResults") == "yes" ? true : false
    let fooCount = 0

    let originalPageTitle

    let attributesToTranslate = []

    let translateNewNodesTimerHandler
    let newNodes = []
    let removedNodes = []

    let nodesToRestore = []

    async function translateNewNodes() {
        try {
            for(const nn of newNodes) {
                if (removedNodes.indexOf(nn) != -1) continue;

                // let newPiecesToTranslate = getPiecesToTranslate(nn)
                let newPiecesToTranslate = (await getNodesThatNeedToTranslate(nn,ctx)).reduce((acc, node) => {
                  return acc.concat(getPiecesToTranslate(node))
                }, [])

                for (const i in newPiecesToTranslate) {
                    const newNodes = newPiecesToTranslate[i].nodes
                    let finded = false

                    for (const ntt of piecesToTranslate) {
                        if (ntt.nodes.some(n1 => newNodes.some(n2 => n1 === n2))) {
                            finded = true
                        }
                    }

                    if (!finded) {
                        piecesToTranslate.push(newPiecesToTranslate[i])
                    }
                }
            }
        } catch (e) {
            console.error(e)
        } finally {
            newNodes = []
            removedNodes = []
        }
    }

    const mutationObserver = new MutationObserver(function (mutations) {
        const piecesToTranslate = []

        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(addedNode => {
                if (htmlTagsNoTranslate.indexOf(addedNode.nodeName) == -1) {
                    if (htmlTagsInlineText.indexOf(addedNode.nodeName) == -1) {
                        if (htmlTagsInlineIgnore.indexOf(addedNode.nodeName) == -1) {
                            piecesToTranslate.push(addedNode)
                        }
                    }
                }
            })

            mutation.removedNodes.forEach(removedNode => {
                removedNodes.push(removedNode)
            })
        })

        piecesToTranslate.forEach(ptt => {
            if (newNodes.indexOf(ptt) == -1) {
                newNodes.push(ptt)
            }
        })
    })

    function enableMutatinObserver() {
        disableMutatinObserver()

        translateNewNodesTimerHandler = setInterval(translateNewNodes, 600)
        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        })
    }

    function disableMutatinObserver() {
        clearInterval(translateNewNodesTimerHandler)
        newNodes = []
        removedNodes = []
        mutationObserver.disconnect()
        mutationObserver.takeRecords()
    }

    let pageIsVisible = document.visibilityState == "visible"
    // isto faz com que partes do youtube não sejam traduzidas
    // new IntersectionObserver(entries => {
    //         if (entries[0].isIntersecting && document.visibilityState == "visible") {
    //             pageIsVisible = true
    //         } else {
    //             pageIsVisible = false
    //         }

    //         if (pageIsVisible && pageLanguageState === "translated") {
    //             enableMutatinObserver()
    //         } else {
    //             disableMutatinObserver()
    //         }
    //     }, {
    //         root: null
    //     })
    //     .observe(document.body)

    const handleVisibilityChange = function () {
        if (document.visibilityState == "visible") {
            pageIsVisible = true
        } else {
            pageIsVisible = false
        }

        if (pageIsVisible && pageLanguageState === "translated") {
            enableMutatinObserver()
        } else {
            disableMutatinObserver()
        }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange, false)

    function getPiecesToTranslate(root = document.body) {
        const piecesToTranslate = [{
            isTranslated: false,
            parentElement: null,
            topElement: null,
            bottomElement: null,
            nodes: []
        }]
        let index = 0
        let currentParagraphSize = 0

        const getAllNodes = function (node, lastHTMLElement = null, lastSelectOrDataListElement = null) {
            if (node.nodeType == 1 || node.nodeType == 11) {
                if (node.nodeType == 11) {
                    lastHTMLElement = node.host
                    lastSelectOrDataListElement = null
                } else if (node.nodeType == 1) {
                    lastHTMLElement = node
                    if (node.nodeName === "SELECT" || node.nodeName === "DATALIST") lastSelectOrDataListElement = node;

                    if (htmlTagsInlineIgnore.indexOf(node.nodeName) !== -1 ||
                        htmlTagsNoTranslate.indexOf(node.nodeName) !== -1 ||
                        node.classList.contains("notranslate") ||
                        node.getAttribute("translate") === "no" ||
                        node.isContentEditable) {
                        if (piecesToTranslate[index].nodes.length > 0) {
                            currentParagraphSize = 0
                            piecesToTranslate[index].bottomElement = lastHTMLElement
                            piecesToTranslate.push({
                                isTranslated: false,
                                parentElement: null,
                                topElement: null,
                                bottomElement: null,
                                nodes: []
                            })
                            index++
                        }
                        return
                    }
                }

                function getAllChilds(childNodes) {
                    Array.from(childNodes).forEach(_node => {
                        if (_node.nodeType == 1) {
                            lastHTMLElement = _node
                            if (_node.nodeName === "SELECT" || _node.nodeName === "DATALIST") lastSelectOrDataListElement = _node;
                        }

                        if (htmlTagsInlineText.indexOf(_node.nodeName) == -1) {
                            if (piecesToTranslate[index].nodes.length > 0) {
                                currentParagraphSize = 0
                                piecesToTranslate[index].bottomElement = lastHTMLElement
                                piecesToTranslate.push({
                                    isTranslated: false,
                                    parentElement: null,
                                    topElement: null,
                                    bottomElement: null,
                                    nodes: []
                                })
                                index++

                            }

                            getAllNodes(_node, lastHTMLElement, lastSelectOrDataListElement)

                            if (piecesToTranslate[index].nodes.length > 0) {
                                currentParagraphSize = 0
                                piecesToTranslate[index].bottomElement = lastHTMLElement
                                piecesToTranslate.push({
                                    isTranslated: false,
                                    parentElement: null,
                                    topElement: null,
                                    bottomElement: null,
                                    nodes: []
                                })
                                index++
                            }
                        } else {
                            getAllNodes(_node, lastHTMLElement, lastSelectOrDataListElement)
                        }
                    })
                }

                getAllChilds(node.childNodes)
                if (!piecesToTranslate[index].bottomElement) {
                    piecesToTranslate[index].bottomElement = node
                }
                if (node.shadowRoot) {
                    getAllChilds(node.shadowRoot.childNodes)
                    if (!piecesToTranslate[index].bottomElement) {
                        piecesToTranslate[index].bottomElement = node
                    }
                }
            } else if (node.nodeType == 3) {
                if (node.textContent.trim().length > 0) {
                    if (!piecesToTranslate[index].parentElement) {
                        if (node && node.parentNode && node.parentNode.nodeName === "OPTION" && lastSelectOrDataListElement) {
                            piecesToTranslate[index].parentElement = lastSelectOrDataListElement
                            piecesToTranslate[index].bottomElement = lastSelectOrDataListElement
                            piecesToTranslate[index].topElement = lastSelectOrDataListElement
                        } else {
                            let temp = node.parentNode
                            while (temp && temp != root && (htmlTagsInlineText.indexOf(temp.nodeName) != -1 || htmlTagsInlineIgnore.indexOf(temp.nodeName) != -1)) {
                                temp = temp.parentNode
                            }
                            if (temp && temp.nodeType === 11) {
                                temp = temp.host
                            }
                            piecesToTranslate[index].parentElement = temp
                        }
                    }
                    if (!piecesToTranslate[index].topElement) {
                        piecesToTranslate[index].topElement = lastHTMLElement
                    }
                    if (currentParagraphSize > 1000) {
                        currentParagraphSize = 0
                        piecesToTranslate[index].bottomElement = lastHTMLElement
                        const pieceInfo = {
                            isTranslated: false,
                            parentElement: null,
                            topElement: lastHTMLElement,
                            bottomElement: null,
                            nodes: []
                        }
                        pieceInfo.parentElement = piecesToTranslate[index].parentElement
                        piecesToTranslate.push(pieceInfo)
                        index++
                    }
                    currentParagraphSize += node.textContent.length
                    piecesToTranslate[index].nodes.push(node)
                    piecesToTranslate[index].bottomElement = null
                }
            }
        }
        getAllNodes(root)

        if (piecesToTranslate.length > 0 && piecesToTranslate[piecesToTranslate.length - 1].nodes.length == 0) {
            piecesToTranslate.pop()
        }

        return piecesToTranslate
    }

    function getAttributesToTranslate(root = document.body) {
        const attributesToTranslate = []

        const placeholdersElements = root.querySelectorAll('input[placeholder], textarea[placeholder]')
        const altElements = root.querySelectorAll('area[alt], img[alt], input[type="image"][alt]')
        // const valueElements = root.querySelectorAll('input[type="button"], input[type="submit"], input[type="reset"]')
        const valueElements = [];
        const titleElements = root.querySelectorAll("body [title]")

        function hasNoTranslate(elem) {
            if (elem && (elem.classList.contains("notranslate") || elem.getAttribute("translate") === "no")) {
                return true
            }
        }

        placeholdersElements.forEach(e => {
            if (hasNoTranslate(e)) return;

            const txt = e.getAttribute("placeholder")
            if (txt && txt.trim()) {
                attributesToTranslate.push({
                    node: e,
                    original: txt,
                    attrName: "placeholder"
                })
            }
        })

        altElements.forEach(e => {
            if (hasNoTranslate(e)) return;

            const txt = e.getAttribute("alt")
            if (txt && txt.trim()) {
                attributesToTranslate.push({
                    node: e,
                    original: txt,
                    attrName: "alt"
                })
            }
        })

        valueElements.forEach(e => {
            if (hasNoTranslate(e)) return;

            const txt = e.getAttribute("value")
            if (e.type == "submit" && !txt) {
                attributesToTranslate.push({
                    node: e,
                    original: "Submit Query",
                    attrName: "value"
                })
            } else if (e.type == "reset" && !txt) {
                attributesToTranslate.push({
                    node: e,
                    original: "Reset",
                    attrName: "value"
                })
            } else if (txt && txt.trim()) {
                attributesToTranslate.push({
                    node: e,
                    original: txt,
                    attrName: "value"
                })
            }
        })

        titleElements.forEach(e => {
            if (hasNoTranslate(e)) return;

            const txt = e.getAttribute("title")
            if (txt && txt.trim()) {
                attributesToTranslate.push({
                    node: e,
                    original: txt,
                    attrName: "title"
                })
            }
        })

        return attributesToTranslate
    }

    function encapsulateTextNode(node,ctx) {
        const pageSpecialConfig = getPageSpecialConfig(ctx);
        const isShowDualLanguage = twpConfig.get("isShowDualLanguage")==='no'?false:true;
        
        
        const fontNode = document.createElement("font")
        let style = 'vertical-align: inherit;'
        if (isShowDualLanguage && (!pageSpecialConfig || pageSpecialConfig.style!=="none")) {
          let customDualStyle = twpConfig.get("customDualStyle");
          let dualStyle = customDualStyle || twpConfig.get("dualStyle") || 'underline';
          if(pageSpecialConfig && pageSpecialConfig.style){
            dualStyle = pageSpecialConfig.style;
          }
          if(dualStyle==='underline'){
            style+='border-bottom: 2px solid #72ECE9;'
          }else if(dualStyle==='none'){
            // ignore
          }else if(dualStyle==="highlight"){
            style+='background-color: #EAD0B3;padding: 3px 0;'
          }else if(dualStyle==="weakening"){
            style+='opacity: 0.4;'
          }else if(dualStyle==="maskxxxxxxxx"){
            style+="filter: blur(5px);transition: filter 0.5s ease;"
            // add class universe-translate-mask
            fontNode.classList.add("universe-translate-mask")
          }else if(dualStyle){
            style+=dualStyle;
          }
        }
        fontNode.setAttribute("style", style)
        // fontNode.setAttribute("_mstmutation", "1")
        // add class name 
        fontNode.textContent = node.textContent

        node.replaceWith(fontNode)

        return fontNode
    }

    async function translateResults(piecesToTranslateNow, results,ctx) {
        if (dontSortResults) {
            for (let i = 0; i < results.length; i++) {
                for (let j = 0; j < results[i].length; j++) {
                    if (piecesToTranslateNow[i].nodes[j]) {
                        const nodes = piecesToTranslateNow[i].nodes
                        let translated = results[i][j] + " "
                        // In some case, results items count is over original node count
                        // Rest results append to last node
                        if (piecesToTranslateNow[i].nodes.length - 1 === j && results[i].length > j) {
                            const restResults = results[i].slice(j + 1);
                            translated += restResults.join(" ");
                        }

                        nodes[j] = encapsulateTextNode(nodes[j],ctx)

                        showOriginal.add(nodes[j])
                        nodesToRestore.push({
                            node: nodes[j],
                            original: nodes[j].textContent
                        })

                       const result = await handleCustomWords(translated, nodes[j].textContent, currentPageTranslatorService, currentTargetLanguage);
                            nodes[j].textContent = result
                    }
                }
            }
        } else {
            for (const i in piecesToTranslateNow) {
                for (const j in piecesToTranslateNow[i].nodes) {
                    if (results[i][j]) {
                        const nodes = piecesToTranslateNow[i].nodes
                        const translated = results[i][j] + " "

                        nodes[j] = encapsulateTextNode(nodes[j],ctx)

                        showOriginal.add(nodes[j])
                        nodesToRestore.push({
                            node: nodes[j],
                            original: nodes[j].textContent
                        })

                      const result =  await handleCustomWords(translated, nodes[j].textContent, currentPageTranslatorService, currentTargetLanguage);
                      nodes[j].textContent = result
                        
                    }
                }
            }
        }
        mutationObserver.takeRecords()
    }

    function translateAttributes(attributesToTranslateNow, results) {
        for (const i in attributesToTranslateNow) {
            const ati = attributesToTranslateNow[i]
            ati.node.setAttribute(ati.attrName, results[i])
        }
    }

    async function translateDynamically() {
        try {
            if (piecesToTranslate && pageIsVisible) {
                ;
                await (async function () {
                    const currentFooCount = fooCount

                    const piecesToTranslateNow = []
                    const batchSize = 10
                    piecesToTranslate.forEach(ptt => {
                        if (!ptt.isTranslated) {
                            piecesToTranslateNow.push(ptt)
                        }
                    })

                    const attributesToTranslateNow = []
                    attributesToTranslate.forEach(ati => {
                        if (!ati.isTranslated) {
                            attributesToTranslateNow.push(ati)
                        }
                    })

                    for (let batchStart = 0; batchStart < piecesToTranslateNow.length; batchStart += batchSize) {
                        const batch = piecesToTranslateNow.slice(batchStart, batchStart + batchSize)
                        batch.forEach(ptt => {
                            ptt.isTranslated = true
                            markNodesTranslating(ptt.nodes)
                        });
                        try {
                            const results = await backgroundTranslateHTML(
                                    currentPageTranslatorService,
                                    currentTargetLanguage,
                                    batch.map(ptt => ptt.nodes.map(node => filterKeywordsInText(node.textContent))),
                                    dontSortResults
                                )
                                if (pageLanguageState === "translated" && currentFooCount === fooCount) {
                                     await translateResults(batch, results,ctx)
                                     const isShowDualLanguage = twpConfig.get("isShowDualLanguage")==='no'?false:true;

                                     if(isShowDualLanguage){
                                        showCopyiedNodes()
                                     }
                                } else {
                                    batch.forEach(ptt => { ptt.isTranslated = false; })
                                }
                        } catch (e) {
                            batch.forEach(ptt => { ptt.isTranslated = false; })
                            console.error(e)
                        } finally {
                            batch.forEach(ptt => unmarkNodesTranslating(ptt.nodes));
                        }
                    }

                    if (attributesToTranslateNow.length > 0) {
                        attributesToTranslateNow.forEach(ati => { ati.isTranslated = true; })
                        backgroundTranslateText(
                                currentPageTranslatorService,
                                currentTargetLanguage,
                                attributesToTranslateNow.map(ati => ati.original)
                            )
                            .then(results => {
                                if (pageLanguageState === "translated" && currentFooCount === fooCount) {
                                    translateAttributes(attributesToTranslateNow, results)
                                } else {
                                    attributesToTranslateNow.forEach(ati => { ati.isTranslated = false; })
                                }
                            })
                            .catch(() => {
                                attributesToTranslateNow.forEach(ati => { ati.isTranslated = false; })
                            })
                    }
                })()
            }
        } catch (e) {
            console.error(e)
        }
        setTimeout(translateDynamically, 600)
    }

    translateDynamically()

    function translatePageTitle() {
        const title = document.querySelector("title");
        if (title && (
                title.classList.contains("notranslate") ||
                title.getAttribute("translate") === "no"
            )) {
            return;
        }
        if (document.title.trim().length < 1) return;
        originalPageTitle = document.title

        backgroundTranslateSingleText(currentPageTranslatorService, currentTargetLanguage, originalPageTitle)
            .then(result => {
                if (result) {
                    document.title = result
                }
            })
    }

    const pageLanguageStateObservers = []

    pageTranslator.onPageLanguageStateChange = function (callback) {
        pageLanguageStateObservers.push(callback)
    }

    pageTranslator.translatePage = async function (targetLanguage) {
        fooCount++
        pageTranslator.restorePage()
        showOriginal.enable()

        dontSortResults = twpConfig.get("dontSortResults") == "yes" ? true : false

        if (targetLanguage) {
            currentTargetLanguage = targetLanguage
        }

        // piecesToTranslate = getPiecesToTranslate()
       try{

        piecesToTranslate = (await getNodesThatNeedToTranslate(document.body,ctx)).reduce((acc, node) => {
          return acc.concat(getPiecesToTranslate(node))
        }, [])
       }catch(e){
         console.error('get pieces failed',e)
         throw e;
       }
        attributesToTranslate = getAttributesToTranslate()
        // TODO
        // attributesToTranslate = [];

        pageLanguageState = "translated"
        chrome.runtime.sendMessage({
            action: "setPageLanguageState",
            pageLanguageState
        })
        pageLanguageStateObservers.forEach(callback => callback(pageLanguageState))
        currentPageLanguage = currentTargetLanguage
        const isTranslateTitle = twpConfig.get("isTranslateTitle") == "yes" ? true : false
        if (isTranslateTitle) {
          translatePageTitle()
        }

        enableMutatinObserver()

        translateDynamically()
    }

    pageTranslator.restorePage = function () {
        fooCount++
        piecesToTranslate = []

        showOriginal.disable()
        disableMutatinObserver()

        pageLanguageState = "original"
        chrome.runtime.sendMessage({
            action: "setPageLanguageState",
            pageLanguageState
        })
        pageLanguageStateObservers.forEach(callback => callback(pageLanguageState))
        currentPageLanguage = originalTabLanguage

        if (originalPageTitle) {
            document.title = originalPageTitle
        }
        originalPageTitle = null
        // remove copyied nodes
        removeCopyiedNodes();


        for (const ntr of nodesToRestore) {
            ntr.node.replaceWith(ntr.original)
        }
        nodesToRestore = []

        //TODO não restaurar atributos que foram modificados
        for (const ati of attributesToTranslate) {
            if (ati.isTranslated) {
                ati.node.setAttribute(ati.attrName, ati.original)
            }
        }
        attributesToTranslate = []
    }

    pageTranslator.swapTranslationService = function () {
        currentPageTranslatorService = twpLang.getNextPageTranslationService(currentPageTranslatorService)
        if (pageLanguageState === "translated") {
            pageTranslator.translatePage()
        }
    }

    let alreadyGotTheLanguage = false
    const observers = []

    let selectionPopup = null
    function removeSelectionPopup() {
        if (selectionPopup) {
            selectionPopup.remove()
            selectionPopup = null
        }
    }

    async function handleTranslateSelectedText(text) {
        removeSelectionPopup()
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return

        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()

        selectionPopup = document.createElement("div")
        selectionPopup.className = "notranslate"
        selectionPopup.setAttribute("style", [
            "all: initial",
            "position: fixed",
            "z-index: 2147483647",
            "max-width: 420px",
            "min-width: 180px",
            "padding: 12px 16px",
            "border-radius: 8px",
            "background: #fff",
            "color: #333",
            "font-size: 14px",
            "line-height: 1.6",
            "box-shadow: 0 4px 24px rgba(0,0,0,0.18)",
            "border: 1px solid #e0e0e0",
            "word-break: break-word",
            "white-space: pre-wrap",
            "font-family: system-ui, -apple-system, sans-serif",
        ].join(";"))
        selectionPopup.textContent = "..."

        let top = rect.bottom + 8
        let left = rect.left
        if (top + 200 > window.innerHeight) {
            top = Math.max(0, rect.top - 200)
        }
        if (left + 420 > window.innerWidth) {
            left = Math.max(0, window.innerWidth - 440)
        }
        selectionPopup.style.top = top + "px"
        selectionPopup.style.left = left + "px"
        document.body.appendChild(selectionPopup)

        const service = currentPageTranslatorService || "google"
        const targetLang = currentTargetLanguage || twpConfig.get("targetLanguage") || "zh-CN"

        try {
            const result = await backgroundTranslateSingleText(service, targetLang, text)
            if (selectionPopup) {
                selectionPopup.textContent = result || text
            }
        } catch (e) {
            if (selectionPopup) {
                selectionPopup.textContent = "Translation failed: " + (e.message || e)
                selectionPopup.style.color = "#e53935"
            }
        }
    }

    document.addEventListener("mousedown", function(e) {
        if (selectionPopup && !selectionPopup.contains(e.target)) {
            removeSelectionPopup()
        }
    })

    pageTranslator.onPageLanguageStateChange = function (callback) {
        if (alreadyGotTheLanguage) {
            callback(originalTabLanguage)
        } else {
            observers.push(callback)
        }
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "translatePage") {
            if (request.targetLanguage === "original") {
                pageTranslator.restorePage()
            } else {
                pageTranslator.translatePage(request.targetLanguage)
            }
        } else if (request.action === "restorePage") {
            pageTranslator.restorePage()
        } else if (request.action === "getOriginalTabLanguage") {
            pageTranslator.onGetOriginalTabLanguage(function () {
                sendResponse(originalTabLanguage)
            })
            return true
        } else if (request.action === "getCurrentPageLanguage") {
            sendResponse(currentPageLanguage)
        } else if (request.action === "getCurrentPageLanguageState") {
            sendResponse(pageLanguageState)
        } else if (request.action === "getCurrentPageTranslatorService") {
            sendResponse(currentPageTranslatorService)
        } else if (request.action === "swapTranslationService") {
            pageTranslator.swapTranslationService()
        } else if (request.action === "toggle-translation") {

            if (pageLanguageState === "translated") {
                pageTranslator.restorePage()
            } else {
                pageTranslator.translatePage()
            }
        } else if (request.action === "autoTranslateBecauseClickedALink") {
            if (twpConfig.get("autoTranslateWhenClickingALink") === "yes") {
                pageTranslator.onGetOriginalTabLanguage(function () {
                    if (pageLanguageState === "original" && originalTabLanguage !== currentTargetLanguage && twpConfig.get("neverTranslateLangs").indexOf(originalTabLanguage) === -1) {
                        pageTranslator.translatePage()
                    }
                })
            }
        } else if (request.action === "translateSelectedText") {
            handleTranslateSelectedText(request.text)
        }
    })

    // Requests the detection of the tab language in the background
    if (window.self === window.top) { // is main frame
        const onTabVisible = function () {
            chrome.runtime.sendMessage({
                action: "detectTabLanguage"
            },async  result => {
                // if und, manual check
                
                if(result === 'und' || !result){
                    result = await detectPageLanguage()
                }              
                result = result || "und"


                if (result === "und") {
                    originalTabLanguage = result
                }

                if (twpConfig.get("alwaysTranslateSites").indexOf(tabHostName) !== -1) {
                    pageTranslator.translatePage()
                }else if(result!=='und'){
                    const langCode = twpLang.fixTLanguageCode(result)
                    if (langCode) {
                        originalTabLanguage = langCode
                    }
                    if (location.hostname === "translatewebpages.org" && location.href.indexOf("?autotranslate") !== -1 && twpConfig.get("neverTranslateSites").indexOf(tabHostName) === -1) {
                        pageTranslator.translatePage()
                    } else {
                        if (location.hostname !== "translate.googleusercontent.com" && location.hostname !== "translate.google.com" && location.hostname !== "translate.yandex.com") {
                            if (pageLanguageState === "original" && !chrome.extension.inIncognitoContext) {
                                if (twpConfig.get("neverTranslateSites").indexOf(tabHostName) === -1) {
                                    if (langCode && langCode !== currentTargetLanguage && twpConfig.get("alwaysTranslateLangs").indexOf(langCode) !== -1) {
                                        pageTranslator.translatePage()
                                    } 
                                }
                            }
                        }
                    }
                }

                observers.forEach(callback => callback(originalTabLanguage))
                alreadyGotTheLanguage = true
            })
        }
        setTimeout(function () {
            if (document.visibilityState == "visible") {
                onTabVisible()
            } else {
                const handleVisibilityChange = function () {
                    if (document.visibilityState == "visible") {
                        document.removeEventListener("visibilitychange", handleVisibilityChange)
                        onTabVisible()
                    }
                }
                document.addEventListener("visibilitychange", handleVisibilityChange, false)
            }
        }, 120)
    } else { // is subframe (iframe)
        chrome.runtime.sendMessage({
            action: "getMainFrameTabLanguage"
        }, result => {
            originalTabLanguage = result || "und"
            observers.forEach(callback => callback(originalTabLanguage))
            alreadyGotTheLanguage = true
        })

        chrome.runtime.sendMessage({
            action: "getMainFramePageLanguageState"
        }, result => {
            if (result === "translated" && pageLanguageState === "original") {
                pageTranslator.translatePage()
            }
        })
    }
})

function detectPageLanguage() {
  return new Promise((resolve, reject) => {
    if(document.documentElement && document.documentElement.lang){
      resolve(document.documentElement.lang)
    }else{
      // use detect language api
      if(document.body && document.body.innerText){
        chrome.runtime.sendMessage({
            action: "detectLanguage",
             text: document.body.innerText
        }, response => {
            resolve(response)
        })
      }else{
        resolve(undefined)
      }
    }
  })

}

