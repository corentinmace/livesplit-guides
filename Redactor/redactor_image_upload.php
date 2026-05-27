<?php
// files storage folder
$files = [];
$types = ['image/png', 'image/jpg', 'image/gif', 'image/jpeg', 'image/pjpeg'];
if (isset($_FILES['file'])) {

    foreach ($_FILES['file']['name'] as $key => $name) {

        $type = strtolower($_FILES['file']['type'][$key]);
        if (in_array($type, $types)) {
            // setting file's mysterious name

            $filename = md5(date('YmdHis')).$key.'_image.jpg';
            $path = 'uploaded_images/'.$filename;

            // copying
            move_uploaded_file($_FILES['file']['tmp_name'][$key], $path);

            $files['file-'.$key] = array(
                'url' => 'uploaded_images/'.$filename
            );
        }
    }
}

echo stripslashes(json_encode($files));