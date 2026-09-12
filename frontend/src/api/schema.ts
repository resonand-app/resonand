/**
 * The API's shape, as types (`UI-3a`).
 *
 * Generated from `openapi.json` by `npm run api:types`. Editing it is pointless -- the check
 * in `api-schema.node.test.ts` fails on anything the generator would not write.
 */

export interface paths {
    "/api/admin/jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The job queue
         * @description Pending, running, done, failed and cancelled work, newest first.
         *
         *     Newest first rather than oldest, because the reason somebody opens this page is that
         *     something has just gone wrong.
         */
        get: operations["list_jobs_api_admin_jobs_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/jobs/counts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * How much work is in each state
         * @description The tally alone, off the same table the rows come from (``FBK-4``).
         *
         *     Separate from ``/status`` because of what that endpoint costs: it walks every file under the
         *     storage root and opens a second engine to read the schema revision, which is the right shape
         *     for a page an operator opens and the wrong shape for anything with an interval on it. The
         *     counts above the queue move while work is being done, so they need one that is cheap to ask.
         */
        get: operations["job_counts_api_admin_jobs_counts_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/jobs/{job_id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Give up on a job
         * @description Cancel work that has not finished. A job already in flight is not interrupted.
         */
        post: operations["cancel_job_api_admin_jobs__job_id__cancel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/jobs/{job_id}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Try a failed job again
         * @description Put a failed or cancelled job back on the queue, with its attempts reset.
         *
         *     Resetting is deliberate: somebody clicking retry has usually just fixed the thing that broke.
         */
        post: operations["retry_job_api_admin_jobs__job_id__retry_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The state of this instance
         * @description Space, counts, queue, schema revision.
         *
         *     The pair of revisions is the load-bearing part: it says whether to roll the image back or the
         *     database forward, which is the question an operator has at the worst possible moment.
         */
        get: operations["system_status_api_admin_status_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/transcription": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Transcription settings
         * @description Reported from configuration alone. Nothing is contacted.
         */
        get: operations["transcription_status_api_admin_transcription_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/transcription/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Test the connection
         * @description Ask the transcription service whether it is there.
         *
         *     An explicit action, on a button, because contacting a third party is not something a page
         *     should do because it was opened. No audio is sent -- this asks for the model list, which is
         *     the cheapest thing an OpenAI-compatible server will answer.
         */
        post: operations["test_transcription_api_admin_transcription_test_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Users */
        get: operations["list_users_api_admin_users_get"];
        put?: never;
        /**
         * Create User
         * @description Registration is administrator-only in v0: accounts are made by hand, for people you know.
         */
        post: operations["create_user_api_admin_users_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/users/{user_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete User
         * @description Delete an account that has nothing in it. Anything else is refused, with the numbers.
         */
        delete: operations["delete_user_api_admin_users__user_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/users/{user_id}/disable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Disable User
         * @description Disable an account. It stops resolving in the ACL on its very next request.
         */
        post: operations["disable_user_api_admin_users__user_id__disable_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/users/{user_id}/enable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Enable User */
        post: operations["enable_user_api_admin_users__user_id__enable_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/audio": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Every recording you can see */
        get: operations["list_audio_api_audio_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/audio/duplicates/{sha256}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Duplicates
         * @description Whether this exact file is already here, trash included (``DEC-16``).
         *
         *     Byte-identical only: a re-encoded copy of the same recording hashes differently, and the
         *     interface must not imply otherwise.
         */
        get: operations["duplicates_api_audio_duplicates__sha256__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/audio/{audio_uuid}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Audio */
        get: operations["get_audio_api_audio__audio_uuid__get"];
        put?: never;
        post?: never;
        /**
         * Trash
         * @description Send a recording to the trash. There is no immediate hard delete anywhere.
         */
        delete: operations["trash_api_audio__audio_uuid__delete"];
        options?: never;
        head?: never;
        /**
         * Update Audio
         * @description Change what a person may change. Requires edit; a reader is told so rather than refused
         *     as though the recording did not exist.
         */
        patch: operations["update_audio_api_audio__audio_uuid__patch"];
        trace?: never;
    };
    "/api/audio/{audio_uuid}/duplicates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Is this exact file already here
         * @description Byte-identical copies of a stored recording, the trash included (``DEC-16``).
         */
        get: operations["check_duplicate_api_audio__audio_uuid__duplicates_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/audio/{audio_uuid}/move": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Move
         * @description Move a recording into another library.
         *
         *     Three consequences, all of which ``UI-19`` has to state before confirming: who can see it
         *     changes, the category is cleared, and grants made on the recording itself survive.
         */
        post: operations["move_api_audio__audio_uuid__move_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/audio/{audio_uuid}/original": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Download the original
         * @description The file exactly as it arrived, under the name it arrived with.
         *
         *     Principle 1 at its most literal: whatever else happens, the bytes you put in come back out.
         */
        get: operations["download_api_audio__audio_uuid__original_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/audio/{audio_uuid}/playback-token": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * A short-lived link for the player
         * @description Mint a token the ``<audio>`` element can carry in its URL.
         *
         *     The real permissions are checked here; the token only records that the check happened.
         */
        post: operations["playback_token_api_audio__audio_uuid__playback_token_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/audio/{audio_uuid}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Restore */
        post: operations["restore_api_audio__audio_uuid__restore_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/audio/{audio_uuid}/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Play a recording
         * @description Serve the Opus derivative, honouring ``Range`` so that seeking works.
         *
         *     Falls back to the original when there is no derivative yet, so a recording is playable the
         *     moment it is uploaded rather than only once the worker has caught up.
         */
        get: operations["stream_api_audio__audio_uuid__stream_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/audio/{audio_uuid}/transcribe": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Ask for a transcription
         * @description Queue a transcription, or say that one is already on its way (``API-11``).
         *
         *     The call to action on a recording with no transcript, the retry after a failure and
         *     re-transcribing one that already has a good transcript are all this endpoint, which is why
         *     **a recording with a job already pending or running answers 409 rather than queueing a
         *     second one**. A double click must not cost two transcriptions, and the interface renders that
         *     409 as a state rather than as an error.
         *
         *     Re-transcribing keeps what is there: ``JOB-7`` writes a new transcript and switches which one
         *     is active atomically, so nothing is lost while the new one is being made.
         */
        post: operations["transcribe_audio_api_audio__audio_uuid__transcribe_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/audio/{audio_uuid}/transcript": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Active Transcript
         * @description The active transcript with its segments, which is what the detail view highlights.
         */
        get: operations["get_active_transcript_api_audio__audio_uuid__transcript_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/audio/{audio_uuid}/transcription": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * What is happening to this recording's transcription
         * @description The state, and the three facts about it that only exist on the job (``API-17``).
         *
         *     Read level, the same as the recording itself: how a transcription of your own recording is
         *     going is not privileged information, and until this endpoint the only way to ask was the
         *     administrator-only queue -- so on a family instance the person whose recording had failed
         *     was the one person who could not find out why (``UI-15b``, ``UI-15c``).
         *
         *     It reports and reaches out to nothing. Whether the provider is answering is ``INT-3c``'s
         *     explicit test, and a status endpoint that contacted it would make opening a recording an
         *     egress.
         */
        get: operations["get_transcription_status_api_audio__audio_uuid__transcription_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/audio/{audio_uuid}/transcripts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Transcripts
         * @description Every transcript a recording has. Re-transcribing keeps the old ones (``UI-14``).
         */
        get: operations["list_transcripts_api_audio__audio_uuid__transcripts_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/audio/{audio_uuid}/transcripts/{transcript_id}/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Activate Transcript
         * @description Switch which transcript is shown. Atomic, and it loses nothing.
         */
        post: operations["activate_transcript_api_audio__audio_uuid__transcripts__transcript_id__activate_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/audio/{audio_uuid}/waveform": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The recording's peaks
         * @description The stored peaks, as the compact binary they are stored as, optionally reduced.
         *
         *     Expanded into JSON, a grid of eighty cards would pull tens of megabytes to draw eighty small
         *     pictures. Sent whole, it still would: a 48-minute recording stores about 28,800 pairs and a
         *     dense row draws them into twenty pixels, so ``peaks`` is what makes ``UI-7c``'s waveform
         *     column and ``UI-31b``'s per-card waveform affordable at all (``ING-14``).
         *
         *     Asking for more than are stored returns what is stored, rather than inventing the difference.
         */
        get: operations["waveform_blob_api_audio__audio_uuid__waveform_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/bootstrap": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Bootstrap
         * @description Create the first account, which is an administrator (``API-7``).
         *
         *     Refused the moment any account exists, so this is not a way in later. The first run is the
         *     only moment an instance has nobody to authorise the request.
         */
        post: operations["bootstrap_api_auth_bootstrap_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The signed-in account */
        get: operations["me_api_auth_me_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Change your own account
         * @description Display name, address and language (``API-13``).
         *
         *     Only the password could be changed before, which left V10's Account and Appearance sections
         *     with nothing to save to. Changing an address re-derives ``email_normalised`` -- the key
         *     identity is decided on -- and answers 409 on a collision, the same as creating an account.
         *
         *     Theme is deliberately absent. It is a property of the screen rather than of the person, and
         *     "follow the system" is already a per-device idea, so it lives in browser storage.
         */
        patch: operations["update_me_api_auth_me_patch"];
        trace?: never;
    };
    "/api/auth/password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Change Password
         * @description Change a password, ending every other session.
         *
         *     Signing the other sessions out is the point of changing a password when you think somebody
         *     else has it. Leaving them alive would make the change decorative.
         */
        post: operations["change_password_api_auth_password_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign in
         * @description Exchange an email and a password for a session cookie.
         */
        post: operations["sign_in_api_auth_session_post"];
        /** Sign out */
        delete: operations["sign_out_api_auth_session_delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Sessions
         * @description Every session this account has, so somebody can notice one they did not start.
         */
        get: operations["list_sessions_api_auth_sessions_get"];
        put?: never;
        post?: never;
        /**
         * Revoke Other Sessions
         * @description Sign out everywhere else. One UPDATE, which is why the session table exists.
         */
        delete: operations["revoke_other_sessions_api_auth_sessions_delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/sessions/{session_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Revoke Session
         * @description Sign one session out from another one.
         */
        delete: operations["revoke_session_api_auth_sessions__session_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/instance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * What this instance is
         * @description Answered without a session, because the sign-in screen needs it before there is one.
         *
         *     It is also where the facts every view needs live, so that nothing hard-codes them: how long
         *     the trash keeps things (``INT-1``) and what an upload may be (``UI-18a``).
         */
        get: operations["instance_state_api_instance_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/libraries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Libraries you can see
         * @description Owned libraries first, then shared ones -- which is the sidebar's own order (``UI-4``).
         */
        get: operations["list_libraries_api_libraries_get"];
        put?: never;
        /** Create Library */
        post: operations["create_library_api_libraries_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/libraries/{library_uuid}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Library */
        get: operations["get_library_api_libraries__library_uuid__get"];
        put?: never;
        post?: never;
        /**
         * Trash Library
         * @description Send a library to the trash. Nothing is deleted until the retention period runs out.
         */
        delete: operations["trash_library_api_libraries__library_uuid__delete"];
        options?: never;
        head?: never;
        /** Update Library */
        patch: operations["update_library_api_libraries__library_uuid__patch"];
        trace?: never;
    };
    "/api/libraries/{library_uuid}/audio": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Library Audio
         * @description What is in a library: filtered, sorted, newest recording first by default (``API-10``).
         *
         *     The filters are the same dependency search takes, and the sort fields are the ones the filter
         *     bar and the column headings both offer -- ``UI-7d`` calls those one sort expressed two ways,
         *     which is only true if there is one list of them.
         */
        get: operations["list_library_audio_api_libraries__library_uuid__audio_get"];
        put?: never;
        /**
         * Upload a recording
         * @description Store a recording and queue the work that turns it into an archived one.
         *
         *     The bytes are written and hashed in one pass -- an hours-long upload is not walked twice --
         *     and the original is never rewritten afterwards.
         *
         *     **The database is not touched while they are arriving** (``REV-1``). The identifier is minted
         *     here rather than by the insert, so the file can be written under its final name with nothing
         *     open, and the row that describes it goes in afterwards in one short transaction. An upload
         *     that held the write lock would stop every other writer in the instance -- the worker
         *     included -- for as long as the upload took, which for an hour of driving is an hour.
         *
         *     The permission is resolved twice deliberately: once before a byte is accepted, so a stranger
         *     is refused rather than served eight gigabytes of patience, and once inside the transaction
         *     that writes, which is the one that decides.
         */
        post: operations["upload_api_libraries__library_uuid__audio_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/libraries/{library_uuid}/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Categories */
        get: operations["list_categories_api_libraries__library_uuid__categories_get"];
        put?: never;
        /** Create Category */
        post: operations["create_category_api_libraries__library_uuid__categories_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/libraries/{library_uuid}/categories/order": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reorder Categories */
        post: operations["reorder_categories_api_libraries__library_uuid__categories_order_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/libraries/{library_uuid}/categories/{category_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete Category
         * @description Remove a node, uncategorising anything that was in it rather than refusing.
         */
        delete: operations["delete_category_api_libraries__library_uuid__categories__category_id__delete"];
        options?: never;
        head?: never;
        /**
         * Update Category
         * @description Rename or re-parent one node. Moving it into its own subtree is refused.
         */
        patch: operations["update_category_api_libraries__library_uuid__categories__category_id__patch"];
        trace?: never;
    };
    "/api/libraries/{library_uuid}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Restore Library */
        post: operations["restore_library_api_libraries__library_uuid__restore_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/libraries/{library_uuid}/shares": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Shares */
        get: operations["list_shares_api_libraries__library_uuid__shares_get"];
        /**
         * Share Library
         * @description Grant access, or change the level somebody already has. Requires manage.
         */
        put: operations["share_library_api_libraries__library_uuid__shares_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/libraries/{library_uuid}/shares/{grantee_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Unshare Library */
        delete: operations["unshare_library_api_libraries__library_uuid__shares__grantee_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search the whole archive
         * @description One ranked list over transcripts and metadata, grouped under the recording.
         */
        get: operations["run_search_api_search_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/search/about": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * What this search can and cannot do
         * @description ``JOB-14``'s limitation, in words the interface can show.
         *
         *     An endpoint rather than a hard-coded string in the frontend, so that the day the index
         *     changes the interface stops describing the old behaviour without anybody remembering to
         *     edit it.
         */
        get: operations["about_search_api_search_about_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Suggest Tags
         * @description Tags on recordings you can read, and only those.
         *
         *     An unfiltered suggestion list over a global vocabulary would be a directory of what everybody
         *     else on the instance records.
         */
        get: operations["suggest_tags_api_tags_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/transcription/destination": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Where audio is sent to be transcribed
         * @description The provider, its host, and whether it is on this network.
         *
         *     Any authenticated caller, deliberately: the answer is about their own recordings.
         */
        get: operations["transcription_destination_api_transcription_destination_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/trash/audio": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Trash
         * @description What is in the trash, with the closest to being purged first (``INT-1``).
         */
        get: operations["list_trash_api_trash_audio_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/trash/audio/{audio_uuid}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Purge
         * @description Destroy one trashed recording now, rather than waiting out its retention (``API-19``).
         *
         *     **In the trash namespace and not a flag on the trashing verb.** Deleting from the trash is
         *     what permanent deletion is, and separating the paths means the irreversible call cannot be
         *     reached by getting a query parameter wrong on the reversible one.
         *
         *     It owns its transaction rather than taking :data:`WriteSession`, because the files go after
         *     the commit and holding the instance's one write lock across a filesystem walk would stop every
         *     other writer for its duration (``REV-1``).
         */
        delete: operations["purge_api_trash_audio__audio_uuid__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/trash/libraries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Trashed Libraries
         * @description Trashed libraries, closest to being purged first, mirroring ``/trash/audio``.
         *
         *     It takes level 30, the same as trashing one: somebody who could only read a library has no
         *     business being told it is on its way out.
         */
        get: operations["list_trashed_libraries_api_trash_libraries_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/trash/libraries/{library_uuid}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Purge Trashed Library
         * @description Destroy one trashed library now, with everything in it (``API-19``).
         *
         *     It takes the recordings whether or not they were trashed separately, which is what trashing a
         *     library already means: the retention purge expires everything inside one on the library's own
         *     clock, so Delete now has to destroy the same set or it would leave behind exactly the rows
         *     waiting a month would have taken. ``INT-1c``'s confirmation states that count first.
         *
         *     Its transaction is its own, for the reason the recording's purge gives.
         */
        delete: operations["purge_trashed_library_api_trash_libraries__library_uuid__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/users/lookup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Find one person by address
         * @description At most one account, for somebody who manages at least one library.
         *
         *     A disabled account is not returned: the ACL refuses one anyway, so offering it would offer a
         *     share that could never work.
         */
        get: operations["lookup_user_api_users_lookup_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * AdminUser
         * @description An account as administration lists it (``API-20``, ``INT-3b``).
         *
         *     Beside :class:`UserSummary` rather than replacing it. That one is what a share and
         *     ``API-15``'s lookup answer with, so ``is_admin`` on it would tell any library manager who runs
         *     the instance -- the same leak the lookup is deliberately narrow to prevent. This shape is
         *     answered by the ``/admin/users`` routes and nowhere else.
         *
         *     ``disabled_at`` rather than a boolean: "disabled since March" is a fact the row has, and
         *     "disabled" is a fact it does not.
         */
        AdminUser: {
            /** Created At */
            created_at: string;
            /** Disabled At */
            disabled_at: string | null;
            /** Display Name */
            display_name: string;
            /** Email */
            email: string;
            /** Id */
            id: number;
            /** Is Admin */
            is_admin: boolean;
        };
        /**
         * AudioDetail
         * @description Everything the detail view shows, including the technical metadata it keeps collapsed.
         */
        AudioDetail: {
            /** Category Id */
            category_id: number | null;
            /** Channels */
            channels: number | null;
            /** Codec */
            codec: string | null;
            /** Created At */
            created_at: string;
            /** Deleted At */
            deleted_at: string | null;
            /** Duration Ms */
            duration_ms: number | null;
            /** Has Waveform */
            has_waveform: boolean;
            /** Is Shared Individually */
            is_shared_individually: boolean;
            level: components["schemas"]["Level"];
            /** Library Uuid */
            library_uuid: string;
            /** Mime */
            mime: string | null;
            /** Notes */
            notes: string | null;
            /** Original Filename */
            original_filename: string | null;
            /** Recorded At */
            recorded_at: string | null;
            /** Recorded At Offset */
            recorded_at_offset: number | null;
            /** Recorded At Source */
            recorded_at_source: string | null;
            /** Sample Rate */
            sample_rate: number | null;
            /** Sha256 */
            sha256: string | null;
            /** Size Bytes */
            size_bytes: number | null;
            /** Tags */
            tags: components["schemas"]["TagSummary"][];
            /** Title */
            title: string;
            /** Transcription State */
            transcription_state: string;
            uploaded_by: components["schemas"]["UserSummary"];
            /** Uuid */
            uuid: string;
        };
        /**
         * AudioSummary
         * @description A recording as the grid and the list draw it (``UI-6``, ``UI-7``).
         */
        AudioSummary: {
            /** Category Id */
            category_id: number | null;
            /** Created At */
            created_at: string;
            /** Deleted At */
            deleted_at: string | null;
            /** Duration Ms */
            duration_ms: number | null;
            /** Has Waveform */
            has_waveform: boolean;
            /** Is Shared Individually */
            is_shared_individually: boolean;
            level: components["schemas"]["Level"];
            /** Library Uuid */
            library_uuid: string;
            /** Notes */
            notes: string | null;
            /** Recorded At */
            recorded_at: string | null;
            /** Recorded At Offset */
            recorded_at_offset: number | null;
            /** Recorded At Source */
            recorded_at_source: string | null;
            /** Tags */
            tags: components["schemas"]["TagSummary"][];
            /** Title */
            title: string;
            /** Transcription State */
            transcription_state: string;
            /** Uuid */
            uuid: string;
        };
        /** Body_upload_api_libraries__library_uuid__audio_post */
        Body_upload_api_libraries__library_uuid__audio_post: {
            /**
             * File
             * @description The recording, in any accepted format.
             */
            file: string;
            /** Language */
            language?: string | null;
            /**
             * Transcribe
             * @default false
             */
            transcribe?: boolean;
        };
        /**
         * Bootstrap
         * @description The first run: an account and its display name, in one step (``UI-21``).
         */
        Bootstrap: {
            /** Display Name */
            display_name: string;
            /** Email */
            email: string;
            /** Password */
            password: string;
        };
        /** CategorySummary */
        CategorySummary: {
            /** Id */
            id: number;
            /** Name */
            name: string;
            /** Parent Id */
            parent_id: number | null;
            /** Position */
            position: number;
        };
        /** ChangePassword */
        ChangePassword: {
            /** Current Password */
            current_password: string;
            /** New Password */
            new_password: string;
        };
        /**
         * Colour
         * @description A library's identifying colour, chosen by whoever created it.
         * @enum {string}
         */
        Colour: "amber" | "clay" | "slate" | "moss" | "stone" | "plum" | "teal";
        /**
         * CreateAccount
         * @description Registration is administrator-only in v0.
         */
        CreateAccount: {
            /** Display Name */
            display_name: string;
            /** Email */
            email: string;
            /**
             * Is Admin
             * @default false
             */
            is_admin?: boolean;
            /** Password */
            password: string;
        };
        /** CreateCategory */
        CreateCategory: {
            /** Name */
            name: string;
            /** Parent Id */
            parent_id?: number | null;
        };
        /** CreateLibrary */
        CreateLibrary: {
            /** @default stone */
            colour?: components["schemas"]["Colour"];
            /** Description */
            description?: string | null;
            /** Name */
            name: string;
        };
        /** CreateShare */
        CreateShare: {
            /** Grantee Id */
            grantee_id: number;
            level: components["schemas"]["Level"];
        };
        /**
         * DuplicateWarning
         * @description A byte-identical file that is already here (``DEC-16``).
         */
        DuplicateWarning: {
            /** In Trash */
            in_trash: boolean;
            /** Library Uuid */
            library_uuid: string;
            /** Title */
            title: string;
            /** Uuid */
            uuid: string;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /**
         * InstanceState
         * @description What the interface needs to know about the instance itself (``UI-21``, ``API-14``).
         *
         *     Everything here is a fact about the instance rather than about a person, which is why this
         *     is the one endpoint answered without a session. None of it is a secret: the version is
         *     already published, and the rest is what somebody would find out by trying.
         */
        InstanceState: {
            /** Accepted Extensions */
            accepted_extensions: string[];
            /** Max Upload Bytes */
            max_upload_bytes: number;
            /** Name */
            name: string;
            /** Needs Bootstrap */
            needs_bootstrap: boolean;
            /** Trash Retention Days */
            trash_retention_days: number;
            /** Version */
            version: string;
            /** Video Extensions */
            video_extensions: string[];
        };
        /**
         * JobSummary
         * @description One piece of background work, as the administration view lists it (``INT-3``).
         */
        JobSummary: {
            /** Attempts */
            attempts: number;
            /** Audio Uuid */
            audio_uuid: string | null;
            /** Created At */
            created_at: string;
            /** Error */
            error: string | null;
            /** Finished At */
            finished_at: string | null;
            /** Id */
            id: number;
            /** Kind */
            kind: string;
            /** Ready At */
            ready_at: string | null;
            /** Started At */
            started_at: string | null;
            /** State */
            state: string;
        };
        /**
         * Level
         * @description What somebody may do with a recording or a library.
         * @enum {integer}
         */
        Level: 10 | 20 | 30 | 40;
        /** LibrarySummary */
        LibrarySummary: {
            /** Audio Count */
            audio_count: number;
            colour: components["schemas"]["Colour"];
            /** Deleted At */
            deleted_at: string | null;
            /** Description */
            description: string | null;
            /** Is Personal */
            is_personal: boolean;
            level: components["schemas"]["Level"];
            /** Name */
            name: string;
            owner: components["schemas"]["UserSummary"];
            /** Total Duration Ms */
            total_duration_ms: number;
            /** Uuid */
            uuid: string;
        };
        /**
         * Me
         * @description The signed-in account.
         */
        Me: {
            /** Display Name */
            display_name: string;
            /** Email */
            email: string;
            /** Id */
            id: number;
            /** Is Admin */
            is_admin: boolean;
            /** Language */
            language: string | null;
        };
        /**
         * MoveAudio
         * @description Its own shape because it has consequences the caller has to have been told about.
         */
        MoveAudio: {
            /** Library Uuid */
            library_uuid: string;
        };
        /** Page[AudioSummary] */
        Page_AudioSummary_: {
            /** Items */
            items: components["schemas"]["AudioSummary"][];
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
            /**
             * Total
             * @description How many rows match, ignoring limit and offset.
             */
            total: number;
        };
        /** Page[JobSummary] */
        Page_JobSummary_: {
            /** Items */
            items: components["schemas"]["JobSummary"][];
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
            /**
             * Total
             * @description How many rows match, ignoring limit and offset.
             */
            total: number;
        };
        /** Page[LibrarySummary] */
        Page_LibrarySummary_: {
            /** Items */
            items: components["schemas"]["LibrarySummary"][];
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
            /**
             * Total
             * @description How many rows match, ignoring limit and offset.
             */
            total: number;
        };
        /** Page[SearchResult] */
        Page_SearchResult_: {
            /** Items */
            items: components["schemas"]["SearchResult"][];
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
            /**
             * Total
             * @description How many rows match, ignoring limit and offset.
             */
            total: number;
        };
        /**
         * ProviderStatus
         * @description Whether transcription is configured and whether it answers.
         *
         *     The credential is never included, in any form. What an administrator needs to know is
         *     whether one is set, not what it is.
         */
        ProviderStatus: {
            /** Base Url */
            base_url: string | null;
            /** Configured */
            configured: boolean;
            /** Default Language */
            default_language: string | null;
            /** Detail */
            detail: string;
            /** Has Credential */
            has_credential: boolean;
            /** Model */
            model: string;
            /** Provider */
            provider: string;
            /** Reachable */
            reachable: boolean | null;
        };
        /** ReorderCategories */
        ReorderCategories: {
            /** Ordered Ids */
            ordered_ids: number[];
        };
        /**
         * SearchMatch
         * @description One place a query matched inside one recording.
         */
        SearchMatch: {
            /** Fragment */
            fragment: string;
            /** Kind */
            kind: string;
            /** Start Ms */
            start_ms: number | null;
        };
        /**
         * SearchResult
         * @description A recording, with the matches inside it grouped under it (``DEC-4``).
         */
        SearchResult: {
            audio: components["schemas"]["AudioSummary"];
            /** Matches */
            matches: components["schemas"]["SearchMatch"][];
            /** Total Matches */
            total_matches: number;
        };
        /** SegmentOut */
        SegmentOut: {
            /** End Ms */
            end_ms: number;
            /** Idx */
            idx: number;
            /** Speaker */
            speaker: string | null;
            /** Start Ms */
            start_ms: number;
            /** Text */
            text: string;
        };
        /**
         * SessionSummary
         * @description One of the account's sign-ins (``UI-20``).
         */
        SessionSummary: {
            /** Created At */
            created_at: string;
            /** Expires At */
            expires_at: string;
            /** Id */
            id: number;
            /** Ip */
            ip: string | null;
            /** Is Current */
            is_current: boolean;
            /** Last Seen At */
            last_seen_at: string;
            /** Revoked At */
            revoked_at: string | null;
            /** User Agent */
            user_agent: string | null;
        };
        /**
         * ShareSummary
         * @description Who has access, at what level, granted by whom and when (``UI-17``).
         */
        ShareSummary: {
            /** Created At */
            created_at: string;
            /** Granted By */
            granted_by: number;
            grantee: components["schemas"]["UserSummary"];
            level: components["schemas"]["Level"];
            /** Level Description */
            level_description: string;
        };
        /** SignIn */
        SignIn: {
            /** Email */
            email: string;
            /** Password */
            password: string;
        };
        /**
         * SortDirection
         * @enum {string}
         */
        SortDirection: "asc" | "desc";
        /**
         * SortField
         * @description What a list of recordings can be ordered by (``API-10``).
         *
         *     Four, and deliberately not every column: these are the ones ``UI-7d`` offers, and a sort
         *     nobody can reach from the interface is a query somebody can make expensive for no benefit.
         * @enum {string}
         */
        SortField: "recorded_at" | "created_at" | "duration_ms" | "title";
        /**
         * StorageStatus
         * @description What the archive is using.
         */
        StorageStatus: {
            /** Database Bytes */
            database_bytes: number;
            /** Derived Bytes */
            derived_bytes: number;
            /** Free Bytes */
            free_bytes: number | null;
            /** Libraries */
            libraries: number;
            /** Originals Bytes */
            originals_bytes: number;
            /** Recordings */
            recordings: number;
            /** Total Duration Ms */
            total_duration_ms: number;
            /** Trashed Recordings */
            trashed_recordings: number;
        };
        /**
         * SystemStatus
         * @description Everything the administration view shows about the instance itself.
         */
        SystemStatus: {
            /** Database Revision */
            database_revision: string | null;
            /** Expected Revision */
            expected_revision: string | null;
            /** Jobs */
            jobs: {
                [key: string]: number;
            };
            storage: components["schemas"]["StorageStatus"];
            transcription: components["schemas"]["ProviderStatus"];
            /** Trash Retention Days */
            trash_retention_days: number;
            /** Version */
            version: string;
        };
        /** TagSuggestion */
        TagSuggestion: {
            tag: components["schemas"]["TagSummary"];
            /** Uses */
            uses: number;
        };
        /** TagSummary */
        TagSummary: {
            /** Id */
            id: number;
            /** Name */
            name: string;
            /** Slug */
            slug: string;
        };
        /**
         * TranscribeRequest
         * @description Ask for a recording to be transcribed (``API-11``).
         */
        TranscribeRequest: {
            /** Language */
            language?: string | null;
        };
        /** TranscriptDetail */
        TranscriptDetail: {
            /** Created At */
            created_at: string;
            /** Id */
            id: number;
            /** Is Active */
            is_active: boolean;
            /** Language */
            language: string | null;
            /** Model */
            model: string | null;
            /** Provider */
            provider: string | null;
            /** Segment Count */
            segment_count: number;
            /** Segments */
            segments: components["schemas"]["SegmentOut"][];
            /** Source */
            source: string;
        };
        /** TranscriptSummary */
        TranscriptSummary: {
            /** Created At */
            created_at: string;
            /** Id */
            id: number;
            /** Is Active */
            is_active: boolean;
            /** Language */
            language: string | null;
            /** Model */
            model: string | null;
            /** Provider */
            provider: string | null;
            /** Segment Count */
            segment_count: number;
            /** Source */
            source: string;
        };
        /**
         * TranscriptionDestination
         * @description Where audio goes, readable by anybody who can ask for a transcription (``API-12``).
         *
         *     Deliberately the narrowest thing that answers the question. The full ``ProviderStatus``
         *     stays administrator-only; this one is what ``UI-25``'s disclosure is drawn from, and a
         *     disclosure only some people can read is not one.
         */
        TranscriptionDestination: {
            /** Configured */
            configured: boolean;
            /** Host */
            host: string | null;
            /** Is Local */
            is_local: boolean;
            /** Provider */
            provider: string;
        };
        /**
         * TranscriptionState
         * @description What the badge says, and what the filter selects.
         * @enum {string}
         */
        TranscriptionState: "none" | "running" | "done" | "failed";
        /**
         * TranscriptionStatus
         * @description What is happening to a recording's transcription, for whoever can read the recording
         *     (``API-17``, ``UI-15``).
         *
         *     ``transcription_state`` on the recording says which of the four states it is in and nothing
         *     more, which is enough for a badge and not enough for a screen: ``UI-15b`` says how long it has
         *     been running and which attempt this is, and ``UI-15c`` shows **the real error text**. Those
         *     three facts live on the job, and the job was only readable through the administrator-only
         *     queue -- so on a shared instance the person whose recording had failed was the one person who
         *     could not be told why.
         *
         *     It reports the newest transcribe job and nothing about any other kind of work: the probe that
         *     could not read a file is a different failure with a different remedy, and ``INT-3d``'s queue is
         *     where an operator sees all four.
         */
        TranscriptionStatus: {
            /** Attempts */
            attempts: number;
            /** Error */
            error: string | null;
            /** Started At */
            started_at: string | null;
            state: components["schemas"]["TranscriptionState"];
        };
        /** UpdateAudio */
        UpdateAudio: {
            /** Category Id */
            category_id?: number | null;
            /**
             * Clear Category
             * @default false
             */
            clear_category?: boolean;
            /** Notes */
            notes?: string | null;
            /** Recorded At */
            recorded_at?: string | null;
            /** Recorded At Offset */
            recorded_at_offset?: number | null;
            /** Tags */
            tags?: string[] | null;
            /** Title */
            title?: string | null;
        };
        /** UpdateCategory */
        UpdateCategory: {
            /**
             * Clear Parent
             * @default false
             */
            clear_parent?: boolean;
            /** Name */
            name?: string | null;
            /** Parent Id */
            parent_id?: number | null;
        };
        /** UpdateLibrary */
        UpdateLibrary: {
            colour?: components["schemas"]["Colour"] | null;
            /** Description */
            description?: string | null;
            /** Name */
            name?: string | null;
        };
        /**
         * UpdateMe
         * @description What somebody may change about their own account (``API-13``).
         *
         *     Every field defaults to "leave this alone", so the interface can save one section of the
         *     settings view without sending back the ones it is not editing. Password is not here: it needs
         *     the current one and ends every other session, which is a different operation.
         */
        UpdateMe: {
            /**
             * Clear Language
             * @default false
             */
            clear_language?: boolean;
            /** Display Name */
            display_name?: string | null;
            /** Email */
            email?: string | null;
            /** Language */
            language?: string | null;
        };
        /**
         * UserSummary
         * @description Somebody the caller can see: themselves, or a person a library is shared with.
         */
        UserSummary: {
            /** Display Name */
            display_name: string;
            /** Email */
            email: string;
            /** Id */
            id: number;
        };
        /** ValidationError */
        ValidationError: {
            /** Context */
            ctx?: Record<string, never>;
            /** Input */
            input?: unknown;
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    list_jobs_api_admin_jobs_get: {
        parameters: {
            query?: {
                state?: string | null;
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_JobSummary_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    job_counts_api_admin_jobs_counts_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: number;
                    };
                };
            };
        };
    };
    cancel_job_api_admin_jobs__job_id__cancel_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    retry_job_api_admin_jobs__job_id__retry_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    system_status_api_admin_status_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SystemStatus"];
                };
            };
        };
    };
    transcription_status_api_admin_transcription_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProviderStatus"];
                };
            };
        };
    };
    test_transcription_api_admin_transcription_test_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProviderStatus"];
                };
            };
        };
    };
    list_users_api_admin_users_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminUser"][];
                };
            };
        };
    };
    create_user_api_admin_users_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateAccount"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminUser"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_user_api_admin_users__user_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    disable_user_api_admin_users__user_id__disable_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminUser"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    enable_user_api_admin_users__user_id__enable_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminUser"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_audio_api_audio_get: {
        parameters: {
            query?: {
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_AudioSummary_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    duplicates_api_audio_duplicates__sha256__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sha256: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DuplicateWarning"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_audio_api_audio__audio_uuid__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                audio_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AudioDetail"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    trash_api_audio__audio_uuid__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                audio_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_audio_api_audio__audio_uuid__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                audio_uuid: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateAudio"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AudioDetail"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    check_duplicate_api_audio__audio_uuid__duplicates_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                audio_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DuplicateWarning"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    move_api_audio__audio_uuid__move_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                audio_uuid: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MoveAudio"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AudioDetail"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    download_api_audio__audio_uuid__original_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                audio_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    playback_token_api_audio__audio_uuid__playback_token_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                audio_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    restore_api_audio__audio_uuid__restore_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                audio_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AudioDetail"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    stream_api_audio__audio_uuid__stream_get: {
        parameters: {
            query?: {
                /** @description A playback token, for <audio>. */
                token?: string | null;
            };
            header?: never;
            path: {
                audio_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    transcribe_audio_api_audio__audio_uuid__transcribe_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                audio_uuid: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TranscribeRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobSummary"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_active_transcript_api_audio__audio_uuid__transcript_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                audio_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TranscriptDetail"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_transcription_status_api_audio__audio_uuid__transcription_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                audio_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TranscriptionStatus"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_transcripts_api_audio__audio_uuid__transcripts_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                audio_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TranscriptSummary"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    activate_transcript_api_audio__audio_uuid__transcripts__transcript_id__activate_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                audio_uuid: string;
                transcript_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TranscriptSummary"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    waveform_blob_api_audio__audio_uuid__waveform_get: {
        parameters: {
            query?: {
                /** @description Reduce to this many pairs before sending. */
                peaks?: number | null;
            };
            header?: never;
            path: {
                audio_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    bootstrap_api_auth_bootstrap_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Bootstrap"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Me"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    me_api_auth_me_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Me"];
                };
            };
        };
    };
    update_me_api_auth_me_patch: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateMe"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Me"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    change_password_api_auth_password_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangePassword"];
            };
        };
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    sign_in_api_auth_session_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SignIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Me"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    sign_out_api_auth_session_delete: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    list_sessions_api_auth_sessions_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionSummary"][];
                };
            };
        };
    };
    revoke_other_sessions_api_auth_sessions_delete: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    revoke_session_api_auth_sessions__session_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    instance_state_api_instance_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InstanceState"];
                };
            };
        };
    };
    list_libraries_api_libraries_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LibrarySummary"][];
                };
            };
        };
    };
    create_library_api_libraries_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateLibrary"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LibrarySummary"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_library_api_libraries__library_uuid__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                library_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LibrarySummary"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    trash_library_api_libraries__library_uuid__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                library_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_library_api_libraries__library_uuid__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                library_uuid: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateLibrary"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LibrarySummary"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_library_audio_api_libraries__library_uuid__audio_get: {
        parameters: {
            query?: {
                limit?: number;
                offset?: number;
                category_id?: number | null;
                /** @description Tag slugs, all of which must match. */
                tag?: string[] | null;
                /** @description Wall-clock, inclusive. */
                recorded_from?: string | null;
                /** @description Wall-clock, inclusive. */
                recorded_to?: string | null;
                min_duration_ms?: number | null;
                max_duration_ms?: number | null;
                /** @description Any of the four states. Repeat it to mean either. */
                transcription_state?: components["schemas"]["TranscriptionState"][] | null;
                sort?: components["schemas"]["SortField"];
                direction?: components["schemas"]["SortDirection"];
            };
            header?: never;
            path: {
                library_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_AudioSummary_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    upload_api_libraries__library_uuid__audio_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                library_uuid: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_upload_api_libraries__library_uuid__audio_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AudioDetail"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_categories_api_libraries__library_uuid__categories_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                library_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CategorySummary"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_category_api_libraries__library_uuid__categories_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                library_uuid: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateCategory"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CategorySummary"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reorder_categories_api_libraries__library_uuid__categories_order_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                library_uuid: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReorderCategories"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CategorySummary"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_category_api_libraries__library_uuid__categories__category_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                library_uuid: string;
                category_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_category_api_libraries__library_uuid__categories__category_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                library_uuid: string;
                category_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateCategory"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CategorySummary"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    restore_library_api_libraries__library_uuid__restore_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                library_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LibrarySummary"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_shares_api_libraries__library_uuid__shares_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                library_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ShareSummary"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    share_library_api_libraries__library_uuid__shares_put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                library_uuid: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateShare"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ShareSummary"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    unshare_library_api_libraries__library_uuid__shares__grantee_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                library_uuid: string;
                grantee_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    run_search_api_search_get: {
        parameters: {
            query?: {
                /** @description What to look for, in words. */
                q?: string;
                limit?: number;
                offset?: number;
                /** @description Restrict to one library's uuid. */
                library?: string | null;
                category_id?: number | null;
                /** @description Tag slugs, all of which must match. */
                tag?: string[] | null;
                /** @description Wall-clock, inclusive. */
                recorded_from?: string | null;
                /** @description Wall-clock, inclusive. */
                recorded_to?: string | null;
                min_duration_ms?: number | null;
                max_duration_ms?: number | null;
                /** @description Any of the four states. Repeat it to mean either. */
                transcription_state?: components["schemas"]["TranscriptionState"][] | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_SearchResult_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    about_search_api_search_about_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
        };
    };
    suggest_tags_api_tags_get: {
        parameters: {
            query?: {
                prefix?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TagSuggestion"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    transcription_destination_api_transcription_destination_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TranscriptionDestination"];
                };
            };
        };
    };
    list_trash_api_trash_audio_get: {
        parameters: {
            query?: {
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_AudioSummary_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    purge_api_trash_audio__audio_uuid__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                audio_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_trashed_libraries_api_trash_libraries_get: {
        parameters: {
            query?: {
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_LibrarySummary_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    purge_trashed_library_api_trash_libraries__library_uuid__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                library_uuid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    lookup_user_api_users_lookup_get: {
        parameters: {
            query: {
                /** @description A full address. Nothing shorter matches. */
                email: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserSummary"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
}
