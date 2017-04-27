define([
    'jquery',
    '/api/config',
    '/bower_components/chainpad-netflux/chainpad-netflux.js',
    '/bower_components/chainpad-crypto/crypto.js',
    '/common/toolbar.js',
    '/bower_components/textpatcher/TextPatcher.amd.js',
    'json.sortify',
    '/bower_components/chainpad-json-validator/json-ot.js',
    '/common/cryptpad-common.js',
    '/common/cryptget.js',
    '/whiteboard/colors.js',
    '/common/visible.js',
    '/common/notify.js',
    '/customize/application_config.js',
    '/bower_components/secure-fabric.js/dist/fabric.min.js',
    '/bower_components/file-saver/FileSaver.min.js',
], function ($, Config, Realtime, Crypto, Toolbar, TextPatcher, JSONSortify, JsonOT, Cryptpad, Cryptget, Colors, Visible, Notify, AppConfig) {
    var saveAs = window.saveAs;
    var Messages = Cryptpad.Messages;

    var module = window.APP = { $:$ };
    var Fabric = module.Fabric = window.fabric;

    $(function () {
    Cryptpad.addLoadingScreen();
    var onConnectError = function (info) {
        Cryptpad.errorLoadingScreen(Messages.websocketError);
    };
    var toolbar;

    var secret = Cryptpad.getSecrets();
    var readOnly = secret.keys && !secret.keys.editKeyStr;
    if (!secret.keys) {
        secret.keys = secret.key;
    }

    var andThen = function () {
        /* Initialize Fabric */
        var canvas = module.canvas = new Fabric.Canvas('canvas');
        var $canvas = $('canvas');
        var $controls = $('#controls');
        var $canvasContainer = $('canvas').parents('.canvas-container');
        var $pickers = $('#pickers');
        var $colors = $('#colors');
        var $cursors = $('#cursors');
        var $deleteButton = $('#delete');

        var brush = {
            color: '#000000',
            opacity: 1
        };

        var $toggle = $('#toggleDraw');
        var $width = $('#width');
        var $widthLabel = $('label[for="width"]');
        var $opacity = $('#opacity');
        var $opacityLabel = $('label[for="opacity"]');
window.canvas = canvas;
        var createCursor = function () {
            var w = canvas.freeDrawingBrush.width;
            var c = canvas.freeDrawingBrush.color;
            var size = w > 30 ? w+2 : w+32;
            $cursors.html('<canvas width="'+size+'" height="'+size+'"></canvas>');
            var $ccanvas = $cursors.find('canvas');
            var ccanvas = $ccanvas[0];

            var ctx = ccanvas.getContext('2d');
            var centerX = size / 2;
            var centerY = size / 2;
            var radius = w/2;

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
            ctx.fillStyle = c;
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = brush.color;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(size/2, 0); ctx.lineTo(size/2, 10);
            ctx.moveTo(size/2, size); ctx.lineTo(size/2, size-10);
            ctx.moveTo(0, size/2); ctx.lineTo(10, size/2);
            ctx.moveTo(size, size/2); ctx.lineTo(size-10, size/2);
            ctx.strokeStyle = '#000000';
            ctx.stroke();


            var img = ccanvas.toDataURL("image/png");
            var $img = $('<img>', {
                src: img,
                title: 'Current brush'
            });
            $controls.find('.selected').html('').append($img);
            canvas.freeDrawingCursor = 'url('+img+') '+size/2+' '+size/2+', crosshair';
        };

        var updateBrushWidth = function () {
            var val = $width.val();
            canvas.freeDrawingBrush.width = Number(val);
            $widthLabel.text(val);
            createCursor();
        };
        updateBrushWidth();

        $width.on('change', updateBrushWidth);

        var updateBrushOpacity = function () {
            var val = $opacity.val();
            brush.opacity = Number(val);
            canvas.freeDrawingBrush.color = Colors.hex2rgba(brush.color, brush.opacity);
            $opacityLabel.text(val);
            createCursor();
        };
        updateBrushOpacity();

        $opacity.on('change', updateBrushOpacity);

        var pickColor = function (current, cb) {
            var $picker = $('<input>', {
                type: 'color',
                value: '#FFFFFF',
                })
            // TODO confirm that this is safe to remove
            //.css({ visibility: 'hidden' })
            .on('change', function () {
                var color = this.value;
                cb(color);
            }).appendTo($pickers);
            setTimeout(function () {
                $picker.val(current);
                $picker.click();
            });
        };

        var setColor = function (c) {
            c = Colors.rgb2hex(c);
            brush.color = c;
            canvas.freeDrawingBrush.color = Colors.hex2rgba(brush.color, brush.opacity);
            module.$color.css({
                'color': c,
            });
            createCursor();
        };


        var palette = AppConfig.whiteboardPalette || [
            'red', 'blue', 'green', 'white', 'black', 'purple',
            'gray', 'beige', 'brown', 'cyan', 'darkcyan', 'gold', 'yellow', 'pink'
        ];

        $('.palette-color').on('click', function () {
            var color = $(this).css('background-color');
            setColor(color);
        });

        module.draw = true;
        var toggleDrawMode = function () {
            module.draw = !module.draw;
            canvas.isDrawingMode = module.draw;
            $toggle.text(module.draw ? Messages.canvas_disable : Messages.canvas_enable);
            if (module.draw) { $deleteButton.hide(); }
            else { $deleteButton.show(); }
        };
        $toggle.click(toggleDrawMode);

        var deleteSelection = function () {
            if (canvas.getActiveObject()) {
                canvas.getActiveObject().remove();
            }
            if (canvas.getActiveGroup()) {
                canvas.getActiveGroup()._objects.forEach(function (el) {
                    el.remove();
                });
                canvas.discardActiveGroup();
            }
            canvas.renderAll();
            module.onLocal();
        };
        $deleteButton.click(deleteSelection);
        $(window).on('keyup', function (e) {
            if (e.which === 46) { deleteSelection (); }
        });

        var setEditable = function (bool) {
            if (readOnly && bool) { return; }
            if (bool) { $controls.show(); }
            else { $controls.hide(); }

            canvas.isDrawingMode = bool ? module.draw : false;
            if (!bool) {
                canvas.deactivateAll();
                canvas.renderAll();
            }
            canvas.forEachObject(function (object) {
                object.selectable = bool;
            });
            $canvasContainer.css('border-color', bool? 'black': 'red');
        };

        var saveImage = module.saveImage = function () {
            var defaultName = "pretty-picture.png";
            Cryptpad.prompt(Messages.exportPrompt, defaultName, function (filename) {
                if (!(typeof(filename) === 'string' && filename)) { return; }
                $canvas[0].toBlob(function (blob) {
                    saveAs(blob, filename);
                });
            });
        };

        var initializing = true;

        var $bar = $('#toolbar');
        var parsedHash = Cryptpad.parsePadUrl(window.location.href);
        var defaultName = Cryptpad.getDefaultName(parsedHash);
        var userData = module.userData = {}; // List of pretty name of all users (mapped with their server ID)
        var userList; // List of users still connected to the channel (server IDs)
        var addToUserData = function(data) {
            var users = module.users;
            for (var attrname in data) { userData[attrname] = data[attrname]; }

            if (users && users.length) {
                for (var userKey in userData) {
                    if (users.indexOf(userKey) === -1) {
                        delete userData[userKey];
                    }
                }
            }

            if(userList && typeof userList.onChange === "function") {
                userList.onChange(userData);
            }
        };

        var myData = {};
        var myUserName = ''; // My "pretty name"
        var myID; // My server ID

        var setMyID = function(info) {
          myID = info.myID || null;
          myUserName = myID;
        };

        var config = module.config = {
            initialState: '{}',
            websocketURL: Cryptpad.getWebsocketURL(),
            validateKey: secret.keys.validateKey,
            readOnly: readOnly,
            channel: secret.channel,
            crypto: Crypto.createEncryptor(secret.keys),
            setMyID: setMyID,
            transformFunction: JsonOT.transform,
        };

        var addColorToPalette = function (color, i) {
            if (readOnly) { return; }
            var $color = $('<span>', {
                'class': 'palette-color',
            })
            .css({
                'background-color': color,
            })
            .click(function () {
                var c = Colors.rgb2hex($color.css('background-color'));
                setColor(c);
            })
            .on('dblclick', function (e) {
                e.preventDefault();
                pickColor(Colors.rgb2hex($color.css('background-color')), function (c) {
                    $color.css({
                        'background-color': c,
                    });
                    palette.splice(i, 1, c);
                    config.onLocal();
                    setColor(c);
                });
            });

            $colors.append($color);
        };

        var updatePalette = function (newPalette) {
            palette = newPalette;
            $colors.html('<div class="hidden">&nbsp;</div>');
            palette.forEach(addColorToPalette);
        };
        updatePalette(palette);

        var suggestName = function (fallback) {
            if (document.title === defaultName) {
                return fallback || "";
            } else {
                return document.title || defaultName;
            }
        };

        var renameCb = function (err, title) {
            if (err) { return; }
            document.title = title;
            config.onLocal();
        };


        var makeColorButton = function ($container) {
            var $testColor = $('<input>', { type: 'color', value: '!' });

            // if colors aren't supported, bail out
            if ($testColor.attr('type') !== 'color' ||
                $testColor.val() === '!') {
                console.log("Colors aren't supported. Aborting");
                return;
            }

            var $color = module.$color = $('<button>', {
                id: "color-picker",
                title: "choose a color",
                'class': "fa fa-square rightside-button",
            })
            .on('click', function () {
                pickColor($color.css('background-color'), function (color) {
                    setColor(color);
                });
            });

            setColor('#000');

            $container.append($color);

            return $color;
        };

        var editHash;
        var onInit = config.onInit = function (info) {
            userList = info.userList;
            var config = {
                displayed: ['useradmin', 'spinner', 'lag', 'state', 'share', 'userlist', 'newpad'],
                userData: userData,
                readOnly: readOnly,
                share: {
                    secret: secret,
                    channel: info.channel
                },
                ifrw: window,
                title: {
                    onRename: renameCb,
                    defaultName: defaultName,
                    suggestName: suggestName
                },
                common: Cryptpad
            };
            if (readOnly) {delete config.changeNameID; }

            toolbar = module.toolbar = Toolbar.create($bar, info.myID, info.realtime, info.getLag, userList, config);

            var $rightside = $bar.find('.' + Toolbar.constants.rightside);
            module.$userNameButton = $($bar.find('.' + Toolbar.constants.changeUsername));

            /* save as template */
            if (!Cryptpad.isTemplate(window.location.href)) {
                var templateObj = {
                    rt: info.realtime,
                    Crypt: Cryptget,
                    getTitle: function () { return document.title; }
                };
                var $templateButton = Cryptpad.createButton('template', true, templateObj);
                $rightside.append($templateButton);
            }

            var $export = Cryptpad.createButton('export', true, {}, saveImage);
            $rightside.append($export);

            var $forget = Cryptpad.createButton('forget', true, {}, function (err, title) {
                if (err) { return; }
                setEditable(false);
                toolbar.failed();
            });
            $rightside.append($forget);

            makeColorButton($rightside);

            var editHash;
            var viewHash = Cryptpad.getViewHashFromKeys(info.channel, secret.keys);

            if (!readOnly) {
                editHash = Cryptpad.getEditHashFromKeys(info.channel, secret.keys);
            }
            if (!readOnly) { Cryptpad.replaceHash(editHash); }

            Cryptpad.onDisplayNameChanged(module.setName);
        };

        // used for debugging, feel free to remove
        var Catch = function (f) {
            return function () {
                try {
                    f();
                } catch (e) {
                    console.error(e);
                }
            };
        };

        var updateTitle = function (newTitle) {
            if (newTitle === document.title) { return; }
            // Change the title now, and set it back to the old value if there is an error
            var oldTitle = document.title;
            document.title = newTitle;
            Cryptpad.renamePad(newTitle, function (err, data) {
                if (err) {
                    console.log("Couldn't set pad title");
                    console.error(err);
                    document.title = oldTitle;
                    return;
                }
                document.title = data;
                $bar.find('.' + Toolbar.constants.title).find('span.title').text(data);
                $bar.find('.' + Toolbar.constants.title).find('input').val(data);
            });
        };

        var updateDefaultTitle = function (defaultTitle) {
            defaultName = defaultTitle;
            $bar.find('.' + Toolbar.constants.title).find('input').attr("placeholder", defaultName);
        };


        var updateMetadata = function(shjson) {
            // Extract the user list (metadata) from the hyperjson
            var json = (shjson === "") ? "" : JSON.parse(shjson);
            var titleUpdated = false;
            if (json && json.metadata) {
                if (json.metadata.users) {
                    var userData = json.metadata.users;
                    // Update the local user data
                    addToUserData(userData);
                }
                if (json.metadata.defaultTitle) {
                    updateDefaultTitle(json.metadata.defaultTitle);
                }
                if (typeof json.metadata.title !== "undefined") {
                    updateTitle(json.metadata.title || defaultName);
                    titleUpdated = true;
                }
                if (typeof(json.metadata.palette) !== 'undefined') {
                    updatePalette(json.metadata.palette);
                }
            }
            if (!titleUpdated) {
                updateTitle(defaultName);
            }
        };

        var unnotify = function () {
            if (module.tabNotification &&
                typeof(module.tabNotification.cancel) === 'function') {
                module.tabNotification.cancel();
            }
        };

        var notify = function () {
            if (Visible.isSupported() && !Visible.currently()) {
                unnotify();
                module.tabNotification = Notify.tab(1000, 10);
            }
        };

        var onRemote = config.onRemote = Catch(function () {
            if (initializing) { return; }
            var userDoc = module.realtime.getUserDoc();

            updateMetadata(userDoc);
            var json = JSON.parse(userDoc);
            var remoteDoc = json.content;

            // TODO update palette if it has changed

            canvas.loadFromJSON(remoteDoc);
            canvas.renderAll();

            var content = canvas.toDatalessJSON();
            if (content !== remoteDoc) { notify(); }
            if (readOnly) { setEditable(false); }
        });
        setEditable(false);

        var stringifyInner = function (textValue) {
            var obj = {
                content: textValue,
                metadata: {
                    users: userData,
                    palette: palette,
                    defaultTitle: defaultName
                }
            };
            if (!initializing) {
                obj.metadata.title = document.title;
            }
            // stringify the json and send it into chainpad
            return JSONSortify(obj);
        };


        var onLocal = module.onLocal = config.onLocal = Catch(function () {
            if (initializing) { return; }
            if (readOnly) { return; }

            var content = stringifyInner(canvas.toDatalessJSON());

            module.patchText(content);
        });

        var setName = module.setName = function (newName) {
            if (typeof(newName) !== 'string') { return; }
            var myUserNameTemp = newName.trim();
            if(newName.trim().length > 32) {
              myUserNameTemp = myUserNameTemp.substr(0, 32);
            }
            myUserName = myUserNameTemp;
            myData[myID] = {
               name: myUserName,
               uid: Cryptpad.getUid(),
            };
            addToUserData(myData);
            Cryptpad.setAttribute('username', myUserName, function (err, data) {
                if (err) {
                    console.log("Couldn't set username");
                    console.error(err);
                    return;
                }
                onLocal();
            });
        };

        var onReady = config.onReady = function (info) {
            var realtime = module.realtime = info.realtime;
            module.patchText = TextPatcher.create({
                realtime: realtime
            });

            var isNew = false;
            var userDoc = module.realtime.getUserDoc();
            if (userDoc === "" || userDoc === "{}") { isNew = true; }

            Cryptpad.removeLoadingScreen();
            setEditable(true);
            initializing = false;
            onRemote();

            if (Visible.isSupported()) {
                Visible.onChange(function (yes) { if (yes) { unnotify(); } });
            }

            /*  TODO: restore palette from metadata.palette */
            Cryptpad.getLastName(function (err, lastName) {
                if (err) {
                    console.log("Could not get previous name");
                    console.error(err);
                    return;
                }
                // Update the toolbar list:
                // Add the current user in the metadata if he has edit rights
                if (readOnly) { return; }
                if (typeof(lastName) === 'string') {
                    setName(lastName);
                } else {
                    myData[myID] = {
                        name: "",
                        uid: Cryptpad.getUid(),
                    };
                    addToUserData(myData);
                    onLocal();
                    module.$userNameButton.click();
                }
                if (isNew) {
                    Cryptpad.selectTemplate('whiteboard', info.realtime, Cryptget);
                }
            });
        };

        var onAbort = config.onAbort = function (info) {
            setEditable(false);
            toolbar.failed();
            Cryptpad.alert(Messages.common_connectionLost, undefined, true);
        };

        // TODO onConnectionStateChange
        var onConnectionChange = config.onConnectionChange = function (info) {
            setEditable(info.state);
            toolbar.failed();
            if (info.state) {
                initializing = true;
                toolbar.reconnecting(info.myId);
                Cryptpad.findOKButton().click();
            } else {
                Cryptpad.alert(Messages.common_connectionLost, undefined, true);
            }
        };

        var rt = Realtime.start(config);

        canvas.on('mouse:up', onLocal);

        $('#clear').on('click', function () {
            canvas.clear();
            onLocal();
        });

        $('#save').on('click', function () {
            saveImage();
        });
    };

    Cryptpad.ready(function (err, env) {
        andThen();
        Cryptpad.reportAppUsage();
    });
    Cryptpad.onError(function (info) {
        if (info) {
            onConnectError();
        }
    });

    });
});
