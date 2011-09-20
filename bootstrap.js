/* ***** BEGIN LICENSE BLOCK *****
 * Version: MIT/X11 License
 * 
 * Copyright (c) 2010 Original Author
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Contributor(s):
 *   Greg Parris <greg.parris@gmail.com> (Original Author)
 *   Erik Vold <erikvvold@gmail.com>
 *
 * ***** END LICENSE BLOCK ***** */

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

const PREF_BRANCH = "extensions.tabcycler.";
const PREFS = {
  cycleBy: "5"
};

var prefChgHandlers = [];
let PREF_OBSERVER = {
  observe: function(aSubject, aTopic, aData) {
    if ("nsPref:changed" != aTopic || !(aData in PREFS)) return;
    prefChgHandlers.forEach(function(func) func && func(aData));
  }
}

function setPref(aKey, aVal) {
  switch (typeof(aVal)) {
    case "string":
      var ss = Cc["@mozilla.org/supports-string;1"]
          .createInstance(Ci.nsISupportsString);
      ss.data = aVal;
      Services.prefs.getBranch(PREF_BRANCH)
          .setComplexValue(aKey, Ci.nsISupportsString, ss);
      break;
  }
}

(function(global) global.include = function include(src) (
    Services.scriptloader.loadSubScript(src, global)))(this);

function main(win) {
  let doc = win.document;
  let gBrowser = win.gBrowser;
  function $(id) doc.getElementById(id);
  function xul(type) doc.createElementNS(NS_XUL, type);

  let isCycling = false;
  let intervalID = null;

  function stopCycle() {
    if (!intervalID) return;
    win.clearInterval(intervalID);
    intervalID = null;
    menu.setAttribute("label", _("cycleTabs"));
  }

  function startCycle(aSeconds) {
    intervalID = win.setInterval(function() {
      gBrowser.selectTabAtIndex(
          (gBrowser.selectedTab._tPos + 1) % gBrowser.tabs.length);
    }, aSeconds * 1E3);
    menu.setAttribute("label", _("cycleTabs.clickToStop"));
  }

  function cycleTabs(intervalSecs) {
    var isPrimaryCommand = intervalSecs == undefined;
    intervalSecs = parseInt(intervalSecs) || parseInt(checkedVal) || intervals[0];

    if (isNaN(intervalSecs))
      throw new Error(_("error.invalidInterval") + intervalSecs);

    // update the "checked" value
    if (checkedVal != intervalSecs)
      setPref("cycleBy", intervalSecs + "");

    // always stop an existing cycle
    stopCycle();

    // stop if the primary menu item was clicked while cycling
    if (isPrimaryCommand && isCycling)
      return (isCycling = false);

    // otherwise start cycling using the new interval
    startCycle(intervalSecs);
    isCycling = true;
  }

  // expose cycleTabs
  gBrowser.cycleTabs = cycleTabs;

  // set up the menu
  var intervals = [1, 2, 3, 4, 5];
  var checkedVal = getPref("cycleBy");

  var menu = xul("splitmenu");
  menu.setAttribute("label", _("cycleTabs"));
  menu.setAttribute("oncommand", "gBrowser.cycleTabs()");

  var menuPopup = xul("menupopup");

  // localized "X seconds"
  var timeTemplate = _("timeTemplate");

  for (var i=0; i < intervals.length; i++) {
    let interval = intervals[i];
    let menuItem = xul("menuitem");
    menuItem.setAttribute("label", timeTemplate.replace("{X}", interval));
    menuItem.setAttribute("name", "cycleTabsItem");
    menuItem.setAttribute("type", "radio");
    menuItem.setAttribute("value", interval);
    menuItem.addEventListener("command", function() cycleTabs(interval), true);
    if (checkedVal == interval) menuItem.setAttribute("checked", "true");
    menuPopup.appendChild(menuItem);
  }

  menu.appendChild(menuPopup);
  $("tabContextMenu").insertBefore(menu, $("context_reloadAllTabs"));

  var prefChgHandlerIndex = prefChgHandlers.push(function(aData) {
    switch (aData) {
      case "cycleBy":
        checkedVal = getPref(aData);
        let children = menuPopup.children;
        for (var i=0; i < children.length; i++)
          children[i].setAttribute("checked", checkedVal == children[i].value);
        break;
    }
  }) - 1;

  unload(function() {
    stopCycle();
    prefChgHandlers[prefChgHandlerIndex] = null;
    menu.parentNode.removeChild(menu);
  }, win);
}

var addon = {
  getResourceURI: function(filePath) ({
    spec: __SCRIPT_URI_SPEC__ + "/../" + filePath
  })
}

function disable(id) {
  Cu.import("resource://gre/modules/AddonManager.jsm");
  AddonManager.getAddonByID(id, function(addon) {
    addon.userDisabled = true;
  });
}

function install() {}
function uninstall(data, reason) {
  if (reason == ADDON_UNINSTALL)
    Services.prefs.getBranch(PREF_BRANCH).resetBranch("");
}
function startup(data) {
  include(addon.getResourceURI("includes/utils.js").spec);

  include(addon.getResourceURI("includes/prefs.js").spec);
  var prefs = Services.prefs.getBranch(PREF_BRANCH);
  prefs = prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
  prefs.addObserver("", PREF_OBSERVER, false);
  setDefaultPrefs();
  unload(function() prefs.removeObserver("", PREF_OBSERVER));

  include(addon.getResourceURI("includes/l10n.js").spec);
  l10n(addon, "tc.properties");
  unload(l10n.unload);

  watchWindows(main, "navigator:browser");
}
function shutdown(data, reason) unload()
