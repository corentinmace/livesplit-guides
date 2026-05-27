(function($R)
{
    $R.add('plugin', 'imagemanager', {
        translations: {
    		en: {
    			"choose": "Choose",
                "send": "Send",
                "paste-url": "Paste url of image..."
    		},
            fr: {
                "choose": "Insérer un lien",
                "send": "Envoyer",
                "paste-url": "Coller le lien de l'image..."
            }
        },
        init: function(app)
        {
            this.app = app;
            this.lang = app.lang;
            this.opts = app.opts;
        },
        // messages
        onmodal: {
            image: {
                open: function($modal, $form)
                {
                    this._load($modal)
                }
            }
        },

		// private
		_load: function($modal)
		{
			var $body = $modal.getBody();
            $body.addClass("img-upload")
			this.$box = $R.dom('<div>');
            this.$box.html('\<div class="img-upload-form-ctn">' +
                '<form method="post" id="img-form">' +
                '<input id="img-url" class="img-form-input" placeholder="' + this.lang.get("paste-url") + '"><button class="img-form-btn">' + this.lang.get("send") + '</button></div>' +
                '</form>' +
                '<div class="img-upload-or">or</div>')

            let $self = this;

            this.$box.find("#img-form").on('submit', function(e) {
                e.preventDefault();

                let input = this.querySelector("#img-url")
                if (!input || !input.value) {
                    return
                }
                $self.app.api('module.image.insert', { image: {
                    url: input.value
                    }
                });
            })
			$body.append((this.$box));
		}
    });
})(Redactor);