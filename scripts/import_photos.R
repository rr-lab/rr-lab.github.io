# Imports lab photos from the shared drive into the Photo Album page.
#
#   Rscript scripts/import_photos.R                       # default folder below
#   Rscript scripts/import_photos.R "/path/to/Lab pictures"
#
# Every photo whose file name starts with a year ("2024 faustos defense.jpg") becomes an album
# entry: the year comes from the name and the rest of the name becomes its caption. The script
# writes web-sized copies with ImageMagick (images/album/, thumbnails in images/album/thumbs/),
# turned upright and with camera metadata (including GPS location) removed, and adds new photos
# to photos.yml. Captions already in photos.yml are kept, so fix captions there. Videos,
# subfolders and files without a year are skipped. Then render the page:
#   Rscript -e 'rmarkdown::render_site("photos.Rmd")'
# Needs ImageMagick (brew install imagemagick).

default_src <- "~/Library/CloudStorage/GoogleDrive-rrellan@ncsu.edu/Shared drives/GemmaLab/Lab pictures"
args <- commandArgs(trailingOnly = TRUE)
src <- path.expand(if (length(args)) args[1] else default_src)
if (!dir.exists(src)) stop("Folder not found: ", src)
if (Sys.which("magick") == "") stop("ImageMagick not found. Install it with: brew install imagemagick")

out_dir <- "images/album"
thumb_dir <- file.path(out_dir, "thumbs")
dir.create(thumb_dir, recursive = TRUE, showWarnings = FALSE)

# Caption from a file name: drop the year and extension, a series number at the end
# ("ZeaL RNA sampling 2"), and tidy names, acronyms and apostrophes.
fixes <- c(
  "rna seq" = "RNA-seq", "mr and mrs" = "Mr. and Mrs.",
  ruben = "Rubén", ruairidh = "Ruairidh", denisse = "Denise", fausto = "Fausto",
  faustos = "Fausto's", shannon = "Shannon", destiny = "Destiny", hannah = "Hannah",
  hannahs = "Hannah's", nirwan = "Nirwan", carolina = "Carolina", pascual = "Pascual",
  katelyn = "Katelyn", kuya = "Kuya", jordan = "Jordan", canela = "Canela",
  allison = "Allison", karla = "Karla", jims = "Jim's", wuf = "Wuf", july = "July",
  cimmyt = "CIMMYT", cerca = "CERCA", gga = "GGA", psu = "PSU", nc = "NC",
  juntos = "JUNTOS", fieldspec = "FieldSpec", intrinsyc = "INTRINSyC", zeal = "ZeaL",
  bucerias = "Bucerías", wallsits = "wall sits"
)
tidy_caption <- function(name) {
  x <- sub("\\.[A-Za-z0-9]+$", "", name)
  x <- sub("^[0-9]{4}[ _-]+", "", x)
  x <- trimws(gsub("\\s+", " ", gsub("_", " ", x)))
  x <- sub(" [0-9]+$", "", x)
  for (w in names(fixes)) {
    x <- gsub(paste0("\\b", w, "\\b"), fixes[[w]], x, ignore.case = TRUE, perl = TRUE)
  }
  x <- gsub(" @ ", " in ", x, fixed = TRUE)
  paste0(toupper(substr(x, 1, 1)), substr(x, 2, nchar(x)))
}
slugify <- function(name) {
  x <- tolower(iconv(sub("\\.[A-Za-z0-9]+$", "", name), "UTF-8", "ASCII//TRANSLIT"))
  gsub("^-+|-+$", "", gsub("[^a-z0-9]+", "-", x))
}

# Existing entries (their captions and order are kept)
yml <- "photos.yml"
photos <- if (file.exists(yml)) yaml::read_yaml(yml)$photos else list()
known <- vapply(photos, function(p) p$source, "")

files <- list.files(src)
files <- files[!dir.exists(file.path(src, files))]
files <- files[grepl("^[0-9]{4}[ _-]", files) &
               grepl("\\.(jpe?g|png|heic|heif|webp|tiff?)$", files, ignore.case = TRUE)]
skipped <- setdiff(list.files(src), c(files, list.dirs(src, full.names = FALSE, recursive = FALSE)))

convert <- function(from, to, size, quality) {
  status <- system2("magick", c(shQuote(paste0(from, "[0]")), "-auto-orient",
    "+profile", shQuote("!icc,*"),                  # keep the colour profile, drop EXIF/GPS/XMP
    "-background", "white", "-alpha", "remove", "-alpha", "off",
    "-resize", shQuote(paste0(size, "x", size, ">")),
    "-quality", quality, "-sampling-factor", "4:2:0", "-interlace", "JPEG", shQuote(to)))
  if (status != 0) stop("ImageMagick failed on ", from)
}

added <- 0
for (f in sort(files)) {
  slug <- slugify(f)
  large <- file.path(out_dir, paste0(slug, ".jpg"))
  thumb <- file.path(thumb_dir, paste0(slug, ".jpg"))
  from <- file.path(src, f)
  stale <- function(out) !file.exists(out) || file.mtime(out) < file.mtime(from)
  if (stale(large)) convert(from, large, 1600, 82)
  if (stale(thumb)) convert(from, thumb, 720, 78)
  if (!(f %in% known)) {
    photos[[length(photos) + 1]] <- list(source = f, year = as.integer(substr(f, 1, 4)),
      caption = tidy_caption(f), file = large, thumb = thumb)
    added <- added + 1
  }
}

gone <- setdiff(known, files)
header <- c(
  "# Lab photo album. photos.Rmd builds the Photo Album page from this file.",
  "#",
  "# scripts/import_photos.R adds new photos from the shared drive's \"Lab pictures\" folder and",
  "# keeps what is already here, so edit captions (and the order within a year) in this file.",
  "# The page shows years newest first; a year's photos appear in the order listed here.",
  "")
writeLines(c(header, yaml::as.yaml(list(photos = photos), indent.mapping.sequence = TRUE)), yml)
cat(sprintf("%d photos in photos.yml (%d new).\n", length(photos), added))
if (length(skipped)) cat("Skipped (videos and files without a year):", paste(skipped, collapse = "; "), "\n")
if (length(gone)) cat("No longer in the folder (still on the page until removed from photos.yml):",
                      paste(gone, collapse = "; "), "\n")
