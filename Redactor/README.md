# Redactor 3.5.2

This repository aims at providing a free version of Imperavi's Redactor, customized to our own needs. 
Current version is 3.5.2 (latest version up to date, 7/10/21) and full documentation can still be found [here](https://imperavi.com/redactor/docs/).


## Requirements

Redactor requires a modern browser with full Javascript and HTML5 support. Redactor has been tested in and fully supports following browsers:

-   Latest Chrome (desktop and mobile)
-   Latest Firefox (desktop only)
-   Latest Safari (desktop and mobile)
-   Latest Opera (webkit)
-   Internet Explorer 11
-   Microsoft Edge

## Quick start

First things first, base styles files must be placed inside the `<head>` tags as follows:

    <head>
      <title>Redactor</title>
      <link rel="stylesheet" href="/your-folder/redactor/redactor.css" />
	</head>
Next, as Redactor is called on a `<textarea>` element, place it wherever you want in the `<body>`.

Then, place all the redactor scripts files (`.js`) needed at the bottom of the `<body>` and call Redactor on the textarea element.

    <body>  
      <textarea id="content"></textarea>
      <script src="/your-folder/redactor/redactor.js"></script>  
      <script> 
        $R('#content'); 
      </script>
    </body>

## Redactor settings

A good amount of settings can be passed with Redactor initialization to customize the editor. The documentation regarding the initialization settings can be found [here](https://imperavi.com/redactor/docs/settings/).

**Note**: The image upload tools will neither be displayed or work as long as there's no `imageUpload` parameter in Redactor initialization. This parameter must be the path to the image upload script. 

    $R('#content',  {
      imageUpload:'/your-folder/your-script.php'  
    });

A working example of this script can be found in this repository as `redactor_image_upload.php`.

## Using plugins

Redactor comes with a lot of pre-built plugins you can use in the editor, like grammar-check, line counter, filemanager, font/background color, etc. Exhaustive list and documentation for these plugins can be found [here](https://imperavi.com/redactor/plugins/).

You can link as many plugins as you like during Redactor's initialization:

    <script> 
      $R('#content', { 
        plugins: ['myplugin', 'anotherplugin'] 
      }); 
    </script>

Note that for each plugin mentioned in `plugins`, you must add the plugin source file at the bottom of the `<body>` tag as well.

You can **create your own plugin** as well, and documentation for this can be found [here](https://imperavi.com/redactor/docs/how-to/create-a-plugin/).

**Note**: The provided example uses an altered version of the `imagemanager` plugin, allowing the user to add an image by its URL and not only by uploading it. The vanilla version of the plugin can be found under the `imagemanager_old` folder.

## Languages

The base tools - plugins excluded - of Redactor are translated into several languages, which can be found under the `_langs` folder.

To use Redactor in another language, it must be specified in the editor's initialization ; again, the base language file must be linked at the end of the `<body>` tag.

    <script src="/your-folder/redactor/_langs/es.js"></script>  
    
    <script>
      $R('#content', { 
        lang: 'es' 
      }); 
    </script>

### Translation in plugins

Plugins are natively not translated, even though some of them are currently translated in French to fit the given examples. All provided plugins can easily be translated though: you just need to add the corresponding translations at the top of their script file:

    (function($R)  {  
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
    ...
