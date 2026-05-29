"use client";



import clsx from "clsx";

import Image from "next/image";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { CmsGalleryAlbum, CmsGalleryAlbumImage, SiteContent } from "@/lib/types";

import {
  CmsConfirmDialog,
  CmsEditorLoadFailed,
  CmsFormActions,
  CmsImageField,
  CmsLoadingState,
  CmsPageHeader,
  CmsSection
} from "../_components/cms-shared";

import { uploadImageToCms } from "../_lib/cms-upload-image";

import { maxEdgeForCmsUsage } from "../_lib/resize-image-for-upload";

import { useAdminSiteContent } from "../_lib/use-admin-site-content";



function newImageId() {

  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

}



function newAlbumId() {

  return `album-${Date.now()}`;

}



function albumThumbnailSrc(album: CmsGalleryAlbum): string {

  const filled = album.images.filter((im) => im.src?.trim());

  return album.coverSrc?.trim() || filled[0]?.src || "/gallery/FTPR_49.JPG";

}



function filterImageFiles(files: FileList | File[]) {

  return Array.from(files).filter((f) => /^image\//.test(f.type));

}



function GalleryAlbumBulkUpload({ onAppendImages }: { onAppendImages: (items: CmsGalleryAlbumImage[]) => void }) {

  const uid = useId();

  const inputId = `${uid}-bulk-files`;

  const inputRef = useRef<HTMLInputElement>(null);

  const dragDepth = useRef(0);

  const [uploading, setUploading] = useState(false);

  const [uploadErr, setUploadErr] = useState("");

  const [dragActive, setDragActive] = useState(false);

  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);



  const maxEdge = maxEdgeForCmsUsage("card");



  const runUploads = useCallback(

    async (files: File[]) => {

      setUploadErr("");

      if (files.length === 0) {

        setUploadErr("No image files in this selection.");

        return;

      }

      setUploading(true);

      setProgress({ done: 0, total: files.length });

      const urls: string[] = [];

      const failed: string[] = [];



      for (let i = 0; i < files.length; i++) {

        const r = await uploadImageToCms(files[i], maxEdge);

        setProgress({ done: i + 1, total: files.length });

        if (!r.ok) {

          failed.push(`${files[i].name}: ${r.message}`);

          continue;

        }

        urls.push(r.url);

      }



      setUploading(false);

      setProgress(null);



      if (urls.length > 0) {

        onAppendImages(urls.map((src) => ({ id: newImageId(), src })));

      }

      if (failed.length > 0) {

        const summary =

          failed.length <= 2 ? failed.join(" · ") : `${failed.slice(0, 2).join(" · ")} (+${failed.length - 2} more)`;

        setUploadErr(

          urls.length > 0 ? `Added ${urls.length} image(s). Some failed: ${summary}` : `Upload failed: ${summary}`

        );

      }

    },

    [maxEdge, onAppendImages]

  );



  const onDragEnter = useCallback((e: React.DragEvent) => {

    e.preventDefault();

    e.stopPropagation();

    dragDepth.current += 1;

    setDragActive(true);

  }, []);



  const onDragLeave = useCallback((e: React.DragEvent) => {

    e.preventDefault();

    e.stopPropagation();

    dragDepth.current -= 1;

    if (dragDepth.current <= 0) {

      dragDepth.current = 0;

      setDragActive(false);

    }

  }, []);



  const onDragOver = useCallback((e: React.DragEvent) => {

    e.preventDefault();

    e.stopPropagation();

  }, []);



  const onDrop = useCallback(

    (e: React.DragEvent) => {

      e.preventDefault();

      e.stopPropagation();

      dragDepth.current = 0;

      setDragActive(false);

      void runUploads(filterImageFiles(e.dataTransfer.files));

    },

    [runUploads]

  );



  const onFileChange = useCallback(

    (e: React.ChangeEvent<HTMLInputElement>) => {

      const list = filterImageFiles(e.target.files ?? []);

      void runUploads(list);

      e.target.value = "";

    },

    [runUploads]

  );



  return (

    <div

      className={clsx("cms-bulk-image-upload", dragActive && "cms-bulk-image-upload--drag", uploading && "cms-bulk-image-upload--busy")}

      onDragEnter={onDragEnter}

      onDragLeave={onDragLeave}

      onDragOver={onDragOver}

      onDrop={onDrop}

    >

      <div className="cms-bulk-image-upload__head">

        <p className="cms-bulk-image-upload__title">Add album images (multiple)</p>

        <p className="cms-bulk-image-upload__hint">

          Choose several files or drag images here. Each file uploads in order and is added below. Same resize rules as single uploads.

        </p>

      </div>

      <div className="cms-bulk-image-upload__body">

        <input

          ref={inputRef}

          id={inputId}

          type="file"

          accept="image/jpeg,image/png,image/webp,image/gif"

          multiple

          className="visually-hidden"

          aria-label="Choose multiple image files for this album"

          onChange={onFileChange}

        />

        <div className="cms-bulk-image-upload__actions">

          <button

            type="button"

            className="btn btn-secondary admin-btn-sm"

            disabled={uploading}

            onClick={() => inputRef.current?.click()}

          >

            {uploading ? "Uploading…" : "Choose multiple images…"}

          </button>

        </div>

        {uploading && progress ? (

          <p className="cms-bulk-image-upload__progress" aria-live="polite">

            Uploading {progress.done} / {progress.total}

          </p>

        ) : null}

        {uploadErr ? (

          <p className="cms-bulk-image-upload__error" role="alert">

            {uploadErr}

          </p>

        ) : null}

      </div>

    </div>

  );

}



type SetAlbums = React.Dispatch<React.SetStateAction<CmsGalleryAlbum[]>>;



function GalleryAlbumEditBody({ album, setAlbums }: { album: CmsGalleryAlbum; setAlbums: SetAlbums }) {

  return (

    <>

      <label className="form-label">

        <span>Album title</span>

        <input

          className="input-field"

          value={album.title}

          onChange={(e) =>

            setAlbums((prev) => prev.map((a) => (a.id === album.id ? { ...a, title: e.target.value } : a)))

          }

        />

      </label>

      <CmsImageField

        label="Cover (thumbnail on gallery index)"

        value={album.coverSrc}

        onChange={(url) => setAlbums((prev) => prev.map((a) => (a.id === album.id ? { ...a, coverSrc: url } : a)))}

        usage="card"

      />

      <GalleryAlbumBulkUpload

        onAppendImages={(items) =>

          setAlbums((prev) => prev.map((a) => (a.id !== album.id ? a : { ...a, images: [...a.images, ...items] })))

        }

      />

      <p className="muted" style={{ fontSize: "0.88rem", margin: "0.5rem 0" }}>

        Images in this album (shown on <code>/gallery/{album.id}</code>):

      </p>

      {album.images.map((im) => (

        <div

          key={im.id}

          style={{ marginBottom: "0.65rem", padding: "0.65rem", border: "1px solid var(--ks-border)", borderRadius: "8px" }}

        >

          <CmsImageField

            label="Image"

            value={im.src}

            onChange={(url) =>

              setAlbums((prev) =>

                prev.map((a) =>

                  a.id !== album.id

                    ? a

                    : { ...a, images: a.images.map((x) => (x.id === im.id ? { ...x, src: url } : x)) }

                )

              )

            }

            usage="card"

          />

          <button

            type="button"

            className="btn btn-secondary admin-btn-sm"

            style={{ marginTop: "0.5rem" }}

            onClick={() =>

              setAlbums((prev) =>

                prev.map((a) => (a.id !== album.id ? a : { ...a, images: a.images.filter((x) => x.id !== im.id) }))

              )

            }

          >

            Remove image

          </button>

        </div>

      ))}

      <button

        type="button"

        className="btn btn-secondary"

        onClick={() =>

          setAlbums((prev) =>

            prev.map((a) =>

              a.id !== album.id ? a : { ...a, images: [...a.images, { id: newImageId(), src: "" }] }

            )

          )

        }

      >

        Add image slot

      </button>

    </>

  );

}



export function GalleryEditor() {

  const { data, loading, err, saving, saveWithNotify, savePartial, load } = useAdminSiteContent();

  const [galleryPageTitle, setGalleryPageTitle] = useState("");

  const [galleryPageLead, setGalleryPageLead] = useState("");

  const [albums, setAlbums] = useState<CmsGalleryAlbum[]>([]);

  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  const [confirmRemoveAlbumId, setConfirmRemoveAlbumId] = useState<string | null>(null);

  const detailRef = useRef<HTMLDivElement>(null);



  const apply = useCallback((c: SiteContent) => {

    setGalleryPageTitle(c.galleryPageTitle);

    setGalleryPageLead(c.galleryPageLead);

    setAlbums(c.galleryAlbums.map((a) => ({ ...a, images: a.images.map((im) => ({ ...im })) })));

  }, []);



  useEffect(() => {

    if (data) apply(data);

  }, [data, apply]);



  useEffect(() => {

    if (selectedAlbumId && !albums.some((a) => a.id === selectedAlbumId)) {

      setSelectedAlbumId(null);

    }

  }, [albums, selectedAlbumId]);



  useEffect(() => {

    if (selectedAlbumId && detailRef.current) {

      detailRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });

    }

  }, [selectedAlbumId]);



  const addEmptyAlbum = useCallback(() => {

    const id = newAlbumId();

    setAlbums((prev) => [...prev, { id, title: "", coverSrc: "", images: [] }]);

    setSelectedAlbumId(id);

  }, []);



  const removeAlbum = useCallback((albumId: string) => {

    setAlbums((prev) => prev.filter((a) => a.id !== albumId));

    setSelectedAlbumId((cur) => (cur === albumId ? null : cur));

  }, []);



  if (loading) return <CmsLoadingState message="Loading gallery editor…" />;

  if (!data) return <CmsEditorLoadFailed err={err} load={load} />;



  const selectedAlbum = selectedAlbumId ? albums.find((a) => a.id === selectedAlbumId) : undefined;
  const confirmRemoveAlbum = confirmRemoveAlbumId ? albums.find((a) => a.id === confirmRemoveAlbumId) : null;

  return (
    <>
    <CmsConfirmDialog
      open={!!confirmRemoveAlbumId}
      title="Remove album?"
      message={confirmRemoveAlbum ? <>Remove album <strong>{confirmRemoveAlbum.title || "Untitled"}</strong> and all its images? This cannot be undone.</> : "Remove this album?"}
      confirmLabel="Remove album"
      onConfirm={() => {
        if (confirmRemoveAlbumId) removeAlbum(confirmRemoveAlbumId);
        setConfirmRemoveAlbumId(null);
      }}
      onCancel={() => setConfirmRemoveAlbumId(null)}
    />

    <section className="page-stack cms-editor-stack cms-editor-stack--cms">

      <CmsPageHeader

        title="Gallery"

        lead="Set the gallery page header, then manage albums. Pick an album from the grid to edit its cover and images."

        previewHref="/gallery"

      />

      <CmsSection

        id="cms-gallery-page"

        title="Page & albums"

        description="Page title and lead appear at the top of /gallery. Albums are edited one at a time — thumbnails below; hover for “Edit album”, or click to open the editor. Save applies all changes."

      >

        <label className="form-label">

          <span>Page title</span>

          <input className="input-field" value={galleryPageTitle} onChange={(e) => setGalleryPageTitle(e.target.value)} />

        </label>

        <label className="form-label">

          <span>Page lead</span>

          <textarea className="input-field" rows={2} value={galleryPageLead} onChange={(e) => setGalleryPageLead(e.target.value)} />

        </label>



        <div className="cms-gallery-albums">

          <div className="cms-gallery-albums__toolbar">

            <h3>Albums {albums.length > 0 ? `(${albums.length})` : ""}</h3>

            <button type="button" className="btn" onClick={addEmptyAlbum}>

              Add album

            </button>

          </div>



          <div className="cms-gallery-albums__grid" role="list">

            {albums.map((album) => {

              const thumb = albumThumbnailSrc(album);

              const unopt = thumb.startsWith("/uploads/");

              const caption = album.title?.trim() || "Untitled album";

              return (

                <button

                  key={album.id}

                  type="button"

                  className={clsx(

                    "cms-gallery-album-tile",

                    selectedAlbumId === album.id && "cms-gallery-album-tile--selected"

                  )}

                  onClick={() => setSelectedAlbumId(album.id)}

                  aria-current={selectedAlbumId === album.id ? "true" : undefined}

                  aria-label={`Edit album: ${caption}`}

                  role="listitem"

                >

                  <div className="cms-gallery-album-tile__media">

                    <Image

                      src={thumb}

                      alt=""

                      fill

                      className="cms-gallery-album-tile__img"

                      sizes="(max-width: 640px) 45vw, 200px"

                      unoptimized={unopt}

                    />

                    <div className="cms-gallery-album-tile__scrim" aria-hidden />

                    <div className="cms-gallery-album-tile__overlay">

                      <span className="cms-gallery-album-tile__edit-label">Edit album</span>

                    </div>

                  </div>

                  <p className="cms-gallery-album-tile__caption" title={caption}>

                    {caption}

                  </p>

                </button>

              );

            })}



            <button
              type="button"
              className="cms-gallery-album-tile cms-gallery-album-tile--add"
              onClick={addEmptyAlbum}
              role="listitem"
              aria-label="Add new album"
            >

              <div className="cms-gallery-album-tile__add-inner">

                <span className="cms-gallery-album-tile__add-icon" aria-hidden>

                  +

                </span>

                <p className="cms-gallery-album-tile__add-text">New album</p>

              </div>

            </button>

          </div>



          {albums.length === 0 ? (

            <p className="cms-gallery-empty-hint">No albums yet. Use Add album or New album to create one.</p>

          ) : null}

        </div>



        {selectedAlbum ? (

          <div ref={detailRef} className="cms-gallery-album-detail" id="gallery-album-detail">

            <div className="cms-gallery-album-detail__bar">

              <h3>

                Editing: {selectedAlbum.title?.trim() || "Untitled album"}{" "}

                <span className="muted" style={{ fontWeight: 400, fontSize: "0.88em" }}>

                  (order #{albums.findIndex((a) => a.id === selectedAlbum.id) + 1})

                </span>

              </h3>

              <div className="cms-gallery-album-detail__bar-actions">

                <button type="button" className="btn btn-secondary admin-btn-sm" onClick={() => setSelectedAlbumId(null)}>

                  ← All albums

                </button>

                <button

                  type="button"

                  className="btn btn-secondary admin-btn-sm"

                  onClick={() => setConfirmRemoveAlbumId(selectedAlbum.id)}

                >

                  Remove album

                </button>

              </div>

            </div>

            <GalleryAlbumEditBody album={selectedAlbum} setAlbums={setAlbums} />

          </div>

        ) : null}



        <CmsFormActions

          primaryLabel="Save gallery"

          onPrimary={() => void saveWithNotify({ galleryPageTitle, galleryPageLead, galleryAlbums: albums }, "Gallery saved successfully.")}

          saving={saving}

        />

      </CmsSection>

    </section>
    </>
  );

}


