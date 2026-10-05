#!/usr/bin/env node
'use strict';
/*
 * Folders inside folders in the media library.
 *
 * The parentId column has been on media_folders since the table was
 * added, and removing a folder already reparents whatever was under it.
 * Nothing could ever SET it: every new folder was created at the top
 * level, and the rail drew one flat list, so a subfolder would have sat
 * beside its parent rather than under it.
 *
 * Two rules carry the weight.
 *
 * A PARENT CONTAINS WHAT IS UNDER IT. Filing a photo in Doors → Handles
 * and then finding Doors empty is exactly what people mean when they say
 * a folder lost their photos. Clicking a parent shows its subfolders'
 * photos too, and its count says the same number.
 *
 * NO FOLDER MAY VANISH. A folder whose parent has gone missing must
 * still be drawn -- one dropped from the walk is a folder full of photos
 * that has silently disappeared, with no way to notice or fix it.
 *
 * Run: node test/media-subfolders.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('media subfolders');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const NAMES = ['mediaFolderTree', 'mediaFolderSubtreeIds', 'mediaFolderPath', 'mediaFolderRemovalPlan'];
const fn = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {}, NAMES);

/*  Doors
      Handles
        Brass
      Hinges
    Paint                */
const F = [
  { id: 1, name: 'Doors',   parentId: null },
  { id: 2, name: 'Handles', parentId: 1 },
  { id: 3, name: 'Brass',   parentId: 2 },
  { id: 4, name: 'Hinges',  parentId: 1 },
  { id: 5, name: 'Paint',   parentId: null },
];
const shape = (tree) => tree.map((x) => `${'.'.repeat(x.depth)}${x.folder.name}`).join(',');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. the order the rail draws ------------------------------ */
{
  eq(shape(fn.mediaFolderTree(F)), 'Doors,.Handles,..Brass,.Hinges,Paint',
    'each folder is followed by what is inside it, carrying how deep it sits');
  eq(fn.mediaFolderTree(F).length, 5, 'and every folder is drawn exactly once');
  eq(shape(fn.mediaFolderTree([])), '', 'no folders draws nothing');
  eq(shape(fn.mediaFolderTree(null)), '', 'and neither does no list at all');

  // Siblings alphabetical, as the flat list always was.
  eq(shape(fn.mediaFolderTree([
    { id: 1, name: 'Zinc', parentId: null }, { id: 2, name: 'Angle', parentId: null },
  ])), 'Angle,Zinc', 'siblings stay in alphabetical order');
}

/* ---------- 2. no folder may vanish ---------------------------------- */
{
  /* THE ONE THAT LOSES PHOTOS. A walk rooted at the top would never
     reach these, and a folder that is not drawn cannot be opened,
     renamed, or emptied -- it is simply gone, along with everything in
     it. Each is shown at the top instead, where it can be dealt with. */
  const orphan = F.concat([{ id: 9, name: 'Lost', parentId: 404 }]);
  t.check(fn.mediaFolderTree(orphan).some((x) => x.folder.id === 9),
    'a folder whose parent no longer exists is still drawn');
  eq(fn.mediaFolderTree(orphan).length, 6, 'and nothing else is lost with it');

  const selfParent = [{ id: 1, name: 'Loop', parentId: 1 }];
  eq(fn.mediaFolderTree(selfParent).length, 1, 'a folder that is its own parent is drawn once');

  const cycle = [{ id: 1, name: 'A', parentId: 2 }, { id: 2, name: 'B', parentId: 1 }];
  eq(fn.mediaFolderTree(cycle).length, 2, 'and a pair pointing at each other does not hang or disappear');

  /* A sync that lands the same row twice would otherwise draw the folder
     twice -- two rows, two counts, two trash buttons for one folder,
     where deleting "the other one" removes the only one there is. */
  const dupe = [{ id: 1, name: 'Doors', parentId: null }, { id: 1, name: 'Doors', parentId: null }];
  eq(fn.mediaFolderTree(dupe).length, 1, 'a folder arriving twice is still drawn once');
}

/* ---------- 2b. a folder with no parentId at all --------------------- */
/*
 * Not the same as parentId: null. A row that reaches the client without
 * the field must be read as top-level, not as the child of a folder
 * called undefined -- otherwise it falls out of the tree walk and is only
 * rescued by the orphan sweep, landing at the bottom of the rail away
 * from the folders it belongs beside.
 */
{
  const missing = [
    { id: 1, name: 'Doors', parentId: null },
    { id: 2, name: 'Blades' },                 // no parentId at all
    { id: 3, name: 'Paint', parentId: null },
  ];
  eq(shape(fn.mediaFolderTree(missing)), 'Blades,Doors,Paint',
    'a folder with no parentId sorts in among the top-level folders, in its alphabetical place');
  eq(fn.mediaFolderSubtreeIds(missing, 2).join(','), '2',
    'and holds itself, not everything else that is also parentless');
}

/* ---------- 3. what a parent contains -------------------------------- */
{
  const ids = (id) => fn.mediaFolderSubtreeIds(F, id).slice().sort((a, b) => a - b).join(',');
  eq(ids(1), '1,2,3,4', 'Doors holds itself, Handles, Brass and Hinges');
  eq(ids(2), '2,3', 'Handles holds itself and Brass');
  eq(ids(3), '3', 'and a folder with nothing inside is just itself');
  eq(ids(5), '5', 'a top-level folder does not pick up its siblings');
  eq(fn.mediaFolderSubtreeIds([], 1).join(','), '1',
    'an unknown folder is still itself, so the grid filters to nothing rather than everything');

  const cycle = [{ id: 1, name: 'A', parentId: 2 }, { id: 2, name: 'B', parentId: 1 }];
  eq(fn.mediaFolderSubtreeIds(cycle, 1).slice().sort().join(','), '1,2',
    'a cycle is walked once rather than for ever');
}

/* ---------- 4. naming a folder in a flat list ------------------------ */
{
  eq(fn.mediaFolderPath(F, 3), 'Doors → Handles → Brass', 'a dropdown says which Brass it is');
  eq(fn.mediaFolderPath(F, 1), 'Doors', 'a top-level folder is just itself');
  eq(fn.mediaFolderPath(F, 404), '', 'an unknown folder names nothing rather than throwing');
  const cycle = [{ id: 1, name: 'A', parentId: 2 }, { id: 2, name: 'B', parentId: 1 }];
  t.check(fn.mediaFolderPath(cycle, 1).length > 0, 'and a cycle still returns a name rather than hanging');
}

/* ---------- 5. removing a folder still reparents ---------------------- */
{
  // Unchanged behaviour, pinned because subfolders make it reachable.
  const plan = fn.mediaFolderRemovalPlan(F, [{ id: 7, folderId: 2 }], 2);
  eq(plan.newParent, 1, 'removing Handles moves what was in it up into Doors');
  eq(plan.movePhotoIds.join(','), '7', 'its photos move rather than being deleted');
  eq(plan.reparentFolderIds.join(','), '3', 'and Brass moves up to Doors rather than being orphaned');
}

/* ---------- 6. wired into the screen --------------------------------- */
{
  const rail = extractFunction(src, 'renderMediaRail', 'index.html');
  t.check(/const tree = mediaFolderTree\(data\.mediaFolders\|\|\[\]\);/.test(rail),
    'the rail draws the tree, not a flat list');
  /* 12 + depth*12, not 10 + depth*14. The step is the same idea and the
     same assertion -- a folder is indented by how deep it sits -- on
     values that are both on the space scale, which 14 never was. */
  t.check(/padding-left:\$\{12 \+ depth\*12\}px/.test(rail),
    'and indents each folder by how deep it sits');

  /* The count must agree with what clicking shows, or a parent reading
     "0" tells somebody their photos are gone. */
  t.check(/const subtreeCount = \(id\)=> mediaFolderSubtreeIds\(data\.mediaFolders\|\|\[\], id\)/.test(rail)
    && /item\(f\.id, f\.name, subtreeCount\(f\.id\), depth\)/.test(rail),
    'a parent counts everything filed under it, so the number matches the grid');

  t.check(/data-mlsub="\$\{key\}" title="Add a folder inside this one"/.test(rail),
    'every folder offers to hold a new one');
  t.check(/mlRailEdit = \{type:'new', parentId: Number\(el\.dataset\.mlsub\)\};/.test(rail),
    'and the new folder is made inside the one that was clicked');
  t.check(/parentId: \(edit && edit\.parentId != null\) \? edit\.parentId : null/.test(rail),
    'which is what actually gets saved on it');
  t.check(/mlRailEdit = \{type:'new', parentId: null\};/.test(rail),
    'while the button at the foot of the rail still makes a top-level folder');
  /* Two boxes open at once would both commit on blur, making two
     folders from one name. */
  t.check(/mlRailEdit\.type==='new' && mlRailEdit\.parentId == null/.test(rail)
    && /mlRailEdit\.type==='new' && mlRailEdit\.parentId === f\.id/.test(rail),
    'only one name box is open at a time — under the folder, or at the foot');

  const visible = extractFunction(src, 'mediaVisibleRows', 'index.html');
  t.check(/const ids = mediaFolderSubtreeIds\(data\.mediaFolders\|\|\[\], mlState\.folder\);/.test(visible)
    && /rows = rows\.filter\(m=> ids\.includes\(m\.folderId\)\)/.test(visible),
    'opening a folder shows what is in its subfolders too');
  const picker = extractFunction(src, 'renderMediaPickerGrid', 'index.html');
  t.check(/mediaFolderSubtreeIds\(data\.mediaFolders\|\|\[\], mpState\.folder\)/.test(picker),
    'and so does the picker, or a photo would be unpickable from its parent');

  /* The flat dropdowns have no room to indent, so they carry paths. The
     inspector's Folder and the selection bar's Move to are both built by
     ONE helper,
     so a fourth cannot be added that forgets the path. WAS: a count of
     exactly two inline mediaFolderPath calls, which held while there were
     exactly two dropdowns and each built its own options. */
  const opts = extractFunction(src, 'mediaFolderOptionsHTML', 'index.html');
  t.check(/mediaFolderTree\(data\.mediaFolders\|\|\[\]\)/.test(opts)
    && /mediaFolderPath\(data\.mediaFolders\|\|\[\], f\.id\)/.test(opts),
    'the folder options are drawn in tree order and name the full path rather than a bare leaf');
  t.check(/<option value="">No folder<\/option>\s*\$\{mediaFolderOptionsHTML\(m\.folderId\)\}/.test(code)
    && /<option value="none">No folder<\/option>`\s*\+ mediaFolderOptionsHTML\(null\)/.test(code),
    'and the inspector and the selection bar draw their dropdown from it');
  /* WAS: the picker's folder dropdown was the third user of the helper.
     The picker now lists folders in its own left-hand column, so the
     same promise is held there instead: tree order, indented by depth,
     and the full path on every row. */
  const pickerNav = extractFunction(src, 'renderMediaPicker', 'index.html');
  t.check(/mediaFolderTree\(data\.mediaFolders\|\|\[\]\)/.test(pickerNav)
    && /padding-left:\$\{10 \+ depth\*12\}px/.test(pickerNav)
    && /title="\$\{esc\(mediaFolderPath\(data\.mediaFolders\|\|\[\], f\.id\)\)\}"/.test(pickerNav),
    'and the picker lists its folders in tree order, indented, each carrying its full path');
  t.check(!/<option value="\$\{f\.id\}"[^>]*>\$\{esc\(f\.name\)\}<\/option>/.test(code),
    'no folder dropdown is built from a bare leaf name');
}

process.exit(t.done() ? 1 : 0);
