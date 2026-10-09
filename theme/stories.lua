-- Turn the `stories` metadata (from _data/stories.yml) into JSON that
-- theme/genome.js reads. Text fields are converted from markdown to HTML, so
-- *italics* in the YAML come out as <em>.
--
-- The JSON is placed inside the div with id "genome-panel".

local function html(meta_value)
  local t = pandoc.utils.type(meta_value)
  if t == "Inlines" then
    return (pandoc.write(pandoc.Pandoc({ pandoc.Plain(meta_value) }), "html"):gsub("\n$", ""))
  elseif t == "Blocks" then
    return (pandoc.write(pandoc.Pandoc(meta_value), "html"):gsub("^<p>", ""):gsub("</p>\n?$", ""))
  end
  return pandoc.utils.stringify(meta_value)
end

local function text(meta_value)
  return meta_value ~= nil and pandoc.utils.stringify(meta_value) or nil
end

local function number(meta_value)
  return meta_value ~= nil and tonumber(pandoc.utils.stringify(meta_value)) or nil
end

local MAIZEGDB = "https://alpha.maizegdb.org/gene_center/gene/"

-- A gene is either plain text or a map with `name` and an optional
-- B73 v5 `id`; an id adds a MaizeGDB link.
local function gene(g)
  if type(g) == "table" and g.name ~= nil then
    local id = text(g.id)
    return { text = html(g.name), id = id, href = id and (MAIZEGDB .. id) or nil }
  end
  return { text = html(g) }
end

local function list(meta_value, f)
  local out = {}
  for _, v in ipairs(meta_value or {}) do
    table.insert(out, f(v))
  end
  return out
end

local function convert(s)
  return {
    id = text(s.id),
    label = html(s.label),
    color = text(s.color),
    inversion = s.inversion == true,
    verified = s.coords_verified == true,
    loci = list(s.loci, function(l)
      return {
        chr = number(l.chr),
        start = number(l.start_mb),
        ["end"] = number(l.end_mb),
        gene = text(l.gene),
      }
    end),
    title = html(s.title),
    story = html(s.story),
    genes = list(s.genes, gene),
    status = html(s.status),
    people = list(s.people, html),
    links = list(s.links, function(l)
      return { text = html(l.text), href = text(l.href) }
    end),
  }
end

local stories_json

function Meta(meta)
  if meta.stories then
    local json = pandoc.json.encode(list(meta.stories, convert))
    -- Keep "</script>" inside a string from closing the tag early.
    stories_json = (json:gsub("</", "<\\/"))
  end
end

function Div(div)
  if div.identifier == "genome-panel" and stories_json then
    div.content:insert(pandoc.RawBlock("html",
      '<script type="application/json" id="genome-stories">' .. stories_json .. "</script>"))
    return div
  end
end

return { { Meta = Meta }, { Div = Div } }
