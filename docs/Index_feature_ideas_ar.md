# أفكار ميزات جاهزة لإضافتها إلى `examples/Index.html`

هذه قائمة أفكار عملية يمكن إضافتها إلى ملف `examples/Index.html`، كلها موجودة ومستخدمة داخل المشروع في أمثلة أخرى. كل بند يحتوي على إشارة لملفات أمثلة تُثبت توفر الميزة وكيفية استخدامها سريعًا لاحقًا.

> ملاحظة: يمكنك تفعيل أغلب الأفكار بعد `viewer.loadGUI(...)` لضمان جاهزية الواجهة.

## واجهة المستخدم واللغة
- فتح/إخفاء الشريط الجانبي تلقائيًا: `viewer.toggleSidebar();`
  - أمثلة: `ca13.html`, `camera_animation.html`
- تعريب الواجهة للعربية: `viewer.setLanguage('ar');`
  - i18next مضمّن. أمثلة تُغيّر اللغة: معظم الأمثلة (تستخدم `'en'`).
- فتح أقسام محددة في القائمة (Appearance/Measurements/Classification)
  - لديك فتح “Appearance” مسبقًا؛ يمكن فتح Panels أخرى بنفس الأسلوب.

## الخلفيات والجودة البصرية
- خلفية Skybox أو بدون خلفية:
  - `viewer.setBackground("skybox");` أو `viewer.setBackground(null);`
  - أمثلة: `annotations.html`, `viewer.html`, `vr_*.html`
- التحكم بشكل/نوع/حجم النقاط:
  - `material.shape = Potree.PointShape.CIRCLE | SQUARE | PARABOLOID;`
  - `material.pointSizeType = Potree.PointSizeType.FIXED | ATTENUATED | ADAPTIVE;`
  - أمثلة: معظم الأمثلة مثل `ca13.html`, `arena4d.html`
- تدرجات الألوان وخواص التلوين:
  - `material.activeAttributeName = "elevation" | "intensity" | "classification";`
  - `material.gradient = Potree.Gradients.SPECTRAL | RAINBOW | GRAYSCALE | ...;`
  - أمثلة: `gradient_colors.html`, إجراءات داخل `annotations.html`

## الخريطة المصغّرة MapView
- إظهار/إخفاء مصادر الخريطة: `viewer.mapView.showSources(false);`
  - مثال: `360.html`
- (اختياري) إعداد أنظمة الإسقاط عبر proj4 عند الحاجة.

## أدوات التحليل
- القياسات (مسافات/مساحات/ارتفاعات): إضافة قياس للمشهد أو استخدام شريط الأدوات.
  - أمثلة: `measurements.html`
- مقطع الارتفاع Elevation Profile + نافذة العرض:
  - إنشاء Profile: `let p = new Potree.Profile(); ...; viewer.scene.addProfile(p);`
  - إظهار النافذة: `viewer.profileWindow.show();`
  - أمثلة: `elevation_profile.html`, `features_sorvilier.html`
- القص/الاقتطاع Clipping Volumes ومهام القص:
  - إضافة `BoxVolume` للمشهد، وضبط: `viewer.setClipTask(Potree.ClipTask.SHOW_INSIDE | HIGHLIGHT);`
  - أمثلة: `clipping_volume.html`, وإجراءات ضمن `annotation_hierarchy.html`

## التعليقات والعناصر التفاعلية (Annotations)
- تعليقات قابلة للنقر مع أزرار إجراءات (تغيير تلوين/انتقال منظور/إظهار نافذة):
  - إنشاء `new Potree.Annotation({...})` وإضافة `actions`.
  - أمثلة: `annotations.html`, `annotation_hierarchy.html`

## تحميل البيانات
- تحميل أكثر من سحابة نقاط في نفس الصفحة:
  - استدعاء `Potree.loadPointCloud(...)` عدة مرات وإضافتها إلى `viewer.scene`.
  - مثال: `multiple_pointclouds.html`
- دعم COPC:
  - استخدام التحميل كما في `copc.html` (مجلد `libs/copc` مضمّن).
- تحميل مشروع محفوظ واسترجاع الحالة (كاميرا/قياسات/تلوين/خلفية):
  - `viewer.loadProject(urlToJson);`
  - أمثلة: `load_project.html`, `page.html`

## وسائط إضافية (صور)
- صور 360 مع تراكب على السحابة:
  - `Potree.Images360Loader.load(basePath, viewer, params).then(imgs => viewer.scene.add360Images(imgs));`
  - مثال: `360.html`
- صور موجّهة Oriented Images:
  - مفيدة لعرض صور فوتوغرافية متزامنة مع السحابة.
  - مثال: `oriented_images.html`

## الحركة والتحريك
- مسارات الكاميرا AnimationPath:
  - إنشاء مسار وتحريك مجسم/الكاميرا.
  - مثال: `animation_paths.html`
- تحريك الكاميرا CameraAnimation بنقاط توقف:
  - `new Potree.CameraAnimation(viewer)` ثم إضافة نقاط والتحكم بالتشغيل.
  - مثال: `camera_animation.html`

## طبقات وكيانات إضافية
- Meshes/Lines فوق السحابة (نماذج/دلائل):
  - أمثلة: `meshes.html`, `lines.html`
- طبقات GIS خارجية: Shapefile/GeoPackage:
  - أمثلة: `shapefiles.html`, `geopackage.html`

## التصنيف Classification
- ضبط ألوان/إظهار تصنيفات محددة (أرض/مباني/نباتات...):
  - إمّا عبر `viewer.setClassifications({...})` أو تعديل `material.classification` ثم `recomputeClassification()`.
  - مثال: `classifications.html`

## التصدير
- تصدير القياسات إلى DXF/GeoJSON:
  - موجود في: `src/exporter/DXFExporter.js`, `src/exporter/GeoJSONExporter.js`
  - فكرة: زرّ في الواجهة يحوّل `viewer.scene.measurements` إلى ملف.

## التكامل الخارجي (اختياري)
- دمج مع Cesium وتزامن الكاميرا لعرض عالمي:
  - أمثلة: `cesium_ca13.html`, `cesium_retz.html`, `cesium_sorvilier.html`

---

### اقتراح تفعيل سريع (اختياري)
- فتح الشريط الجانبي + تلوين ارتفاع + نافذة البروفايل:
  1) بعد `loadGUI`: `viewer.toggleSidebar(); viewer.setLanguage('ar');`
  2) عند تحميل السحابة: `material.activeAttributeName = 'elevation';`
  3) إنشاء Profile بسيط وإظهاره: `viewer.profileWindow.show();`

> عند رغبتك، يمكنني تنفيذ باقة “إظهار البروفايل + تدرّج ارتفاع + زرّ تصدير GeoJSON للقياسات” مباشرة داخل `Index.html`. 
