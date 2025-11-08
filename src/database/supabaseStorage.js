import { supabase } from './supabaseInit.js';

/**
 * Upload image to Supabase Storage
 * @param {File} file - Image file to upload
 * @param {string} folder - Folder path (e.g., 'thumbnails')
 * @returns {Promise<string>} - Public URL of uploaded image
 */

async function uploadImageToSupabase(file, folder = 'thumbnails') {
    try {
        // Validate file
        if (!file.type.startsWith('image/')) {
            throw new Error('Please select a valid image file');
        }

        // Max 5MB
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('Image size must be less than 5MB');
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('course-thumbnails')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Supabase upload error:', error);
            throw new Error(error.message);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('course-thumbnails')
            .getPublicUrl(fileName);

        return urlData.publicUrl;
    } catch (error) {
        console.error('Upload failed:', error);
        throw error;
    }
}

/**
 * Delete image from Supabase Storage
 * @param {string} fileUrl - Full URL of the file to delete
 */
async function deleteImageFromSupabase(fileUrl) {
    try {
        // Extract file path from URL
        const urlParts = fileUrl.split('/storage/v1/object/public/course-thumbnails/');
        if (urlParts.length < 2) {
            throw new Error('Invalid file URL');
        }

        const filePath = urlParts[1];

        const { error } = await supabase.storage
            .from('course-thumbnails')
            .remove([filePath]);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('Delete failed:', error);
        throw error;
    }
}

export { uploadImageToSupabase, deleteImageFromSupabase };


// // supabaseStorage.js
// import { supabase } from './supabaseInit.js';

// /**
//  * Upload image to Supabase Storage
//  */
// async function uploadImageToSupabase(file, folder = 'thumbnails') {
//   try {

//     if (!file || !file.type || !file.type.startsWith('image/')) {
//       throw new Error('Please select a valid image file');
//     }
//     if (file.size > 5 * 1024 * 1024) {
//       throw new Error('Image size must be less than 5MB');
//     }

//     const fileExt = (file.name || 'img').split('.').pop();
//     const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
//     // Always prefix subfolder for easier organization
//     const filePath = folder ? `${folder}/${fileName}` : fileName;

//     console.log('📤 Uploading to bucket: course-thumbnails');
//     console.log('📂 File path:', filePath);

//     // DEBUG: show that supabase client has an accessToken (optional)
//     try {
//       const { data: session } = await supabase.auth.getSession?.();
//       console.log('🔐 supabase.session (maybe null):', session);
//     } catch (e) {
//       // some supabase versions may not have getSession in the same way — ignore
//       console.debug('supabase: session read skipped', e?.message || e);
//     }

//     // Upload file; include contentType
//     const { data, error } = await supabase.storage
//       .from('course-thumbnails')
//       .upload(filePath, file, {
//         cacheControl: '3600',
//         upsert: false,
//         contentType: file.type,
//       });

//     if (error) {
//       console.error('❌ Supabase upload error:', error);
//       throw new Error(error.message || JSON.stringify(error));
//     }

//     console.log('✅ Upload successful:', data);

//     const { data: urlData } = supabase.storage
//       .from('course-thumbnails')
//       .getPublicUrl(filePath);

//     console.log('🔗 Public URL:', urlData.publicUrl);
//     return urlData.publicUrl;
//   } catch (error) {
//     console.error('❌ Upload failed:', error);
//     throw error;
//   }
// }

// async function deleteImageFromSupabase(fileUrl) {
//   try {
//     const urlParts = fileUrl.split('/storage/v1/object/public/course-thumbnails/');
//     if (urlParts.length < 2) {
//       console.error('❌ Invalid file URL format:', fileUrl);
//       throw new Error('Invalid file URL');
//     }

//     const filePath = decodeURIComponent(urlParts[1]);
//     console.log('🗑️ Deleting file:', filePath);

//     const { error } = await supabase.storage
//       .from('course-thumbnails')
//       .remove([filePath]);

//     if (error) {
//       console.error('❌ Delete error:', error);
//       throw error;
//     }
//     console.log('✅ File deleted successfully');
//     return true;
//   } catch (error) {
//     console.error('❌ Delete failed:', error);
//     throw error;
//   }
// }

// export { uploadImageToSupabase, deleteImageFromSupabase };
