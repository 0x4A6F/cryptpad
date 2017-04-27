define([
    'jquery',
    '/customize/messages.js',
    '/common/common-util.js',
    '/customize/application_config.js',
    '/bower_components/alertifyjs/dist/js/alertify.js'
], function ($, Messages, Util, AppConfig, Alertify) {

    var UI = {};

    /*
     *  Alertifyjs
     */
    UI.Alertify = Alertify;

    // set notification timeout
    Alertify._$$alertify.delay = AppConfig.notificationTimeout || 5000;

    var findCancelButton = UI.findCancelButton = function () {
        return $('button.cancel');
    };

    var findOKButton = UI.findOKButton = function () {
        return $('button.ok');
    };

    var listenForKeys = UI.listenForKeys = function (yes, no) {
        var handler = function (e) {
            switch (e.which) {
                case 27: // cancel
                    if (typeof(no) === 'function') { no(e); }
                    no();
                    break;
                case 13: // enter
                    if (typeof(yes) === 'function') { yes(e); }
                    break;
            }
        };

        $(window).keyup(handler);
        return handler;
    };

    var stopListening = UI.stopListening = function (handler) {
        $(window).off('keyup', handler);
    };

    UI.alert = function (msg, cb, force) {
        cb = cb || function () {};
        if (force !== true) { msg = Util.fixHTML(msg); }
        var close = function (e) {
            findOKButton().click();
        };
        var keyHandler = listenForKeys(close, close);
        Alertify.alert(msg, function (ev) {
            cb(ev);
            stopListening(keyHandler);
        });
        window.setTimeout(function () {
            findOKButton().focus();
        });
    };

    UI.prompt = function (msg, def, cb, opt, force) {
        opt = opt || {};
        cb = cb || function () {};
        if (force !== true) { msg = Util.fixHTML(msg); }

        var keyHandler = listenForKeys(function (e) { // yes
            findOKButton().click();
        }, function (e) { // no
            findCancelButton().click();
        });

        Alertify
            .defaultValue(def || '')
            .okBtn(opt.ok || Messages.okButton || 'OK')
            .cancelBtn(opt.cancel || Messages.cancelButton || 'Cancel')
            .prompt(msg, function (val, ev) {
                cb(val, ev);
                stopListening(keyHandler);
            }, function (ev) {
                cb(null, ev);
                stopListening(keyHandler);
            });
    };

    UI.confirm = function (msg, cb, opt, force, styleCB) {
        opt = opt || {};
        cb = cb || function () {};
        if (force !== true) { msg = Util.fixHTML(msg); }

        var keyHandler = listenForKeys(function (e) {
            findOKButton().click();
        }, function (e) {
            findCancelButton().click();
        });

        Alertify
            .okBtn(opt.ok || Messages.okButton || 'OK')
            .cancelBtn(opt.cancel || Messages.cancelButton || 'Cancel')
            .confirm(msg, function () {
                cb(true);
                stopListening(keyHandler);
            }, function () {
                cb(false);
                stopListening(keyHandler);
            });

        window.setTimeout(function () {
            var $ok = findOKButton();
            var $cancel = findCancelButton();
            if (opt.okClass) { $ok.addClass(opt.okClass); }
            if (opt.cancelClass) { $cancel.addClass(opt.cancelClass); }
            if (opt.reverseOrder) {
                $ok.insertBefore($ok.prev());
            }
            if (typeof(styleCB) === 'function') {
                styleCB($ok.closest('.dialog'));
            }
        }, 0);
    };

    UI.log = function (msg) {
        Alertify.success(Util.fixHTML(msg));
    };

    UI.warn = function (msg) {
        Alertify.error(Util.fixHTML(msg));
    };

    /*
     *  spinner
     */
    UI.spinner = function (parent) {
        var $target = $('<span>', {
            'class': 'fa fa-spinner fa-pulse fa-4x fa-fw'
        }).hide();

        $(parent).append($target);

        return {
            show: function () {
                $target.show();
                return this;
            },
            hide: function () {
                $target.hide();
                return this;
            },
            get: function () {
                return $target;
            },
        };
    };

    var LOADING = 'loading';

    var getRandomTip = function () {
        if (!Messages.tips || !Object.keys(Messages.tips).length) { return ''; }
        var keys = Object.keys(Messages.tips);
        var rdm = Math.floor(Math.random() * keys.length);
        return Messages.tips[keys[rdm]];
    };
    UI.addLoadingScreen = function (loadingText, hideTips) {
        var $loading, $container;
        if ($('#' + LOADING).length) {
            $loading = $('#' + LOADING).show();
            if (loadingText) {
                $('#' + LOADING).find('p').text(loadingText);
            }
            $container = $loading.find('.loadingContainer');
        } else {
            $loading = $('<div>', {id: LOADING});
            $container = $('<div>', {'class': 'loadingContainer'});
            $container.append('<img class="cryptofist" src="/customize/cryptofist_small.png" />');
            var $spinner = $('<div>', {'class': 'spinnerContainer'});
            UI.spinner($spinner).show();
            var $text = $('<p>').text(loadingText || Messages.loading);
            $container.append($spinner).append($text);
            $loading.append($container);
            $('body').append($loading);
        }
        if (Messages.tips && !hideTips) {
            var $loadingTip = $('<div>', {'id': 'loadingTip'});
            var $tip = $('<span>', {'class': 'tips'}).text(getRandomTip()).appendTo($loadingTip);
            $loadingTip.css({
                'top': $('body').height()/2 + $container.height()/2 + 20 + 'px'
            });
            $('body').append($loadingTip);
        }
    };
    UI.removeLoadingScreen = function (cb) {
        $('#' + LOADING).fadeOut(750, cb);
        $('#loadingTip').css('top', '');
        window.setTimeout(function () {
            $('#loadingTip').fadeOut(750);
        }, 3000);
    };
    UI.errorLoadingScreen = function (error, transparent) {
        if (!$('#' + LOADING).is(':visible')) { UI.addLoadingScreen(undefined, true); }
        $('.spinnerContainer').hide();
        if (transparent) { $('#' + LOADING).css('opacity', 0.8); }
        $('#' + LOADING).find('p').html(error || Messages.error);
    };

    var importContent = UI.importContent = function (type, f) {
        return function () {
            var $files = $('<input type="file">').click();
            $files.on('change', function (e) {
                var file = e.target.files[0];
                var reader = new FileReader();
                reader.onload = function (e) { f(e.target.result, file); };
                reader.readAsText(file, type);
            });
        };
    };

    return UI;
});
