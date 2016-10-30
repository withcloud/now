import gulp from 'gulp'
import babel from 'gulp-babel'
import cache from 'gulp-cached'

const paths = {
  src: 'src/**/*'
}

gulp.task('transpile', () => gulp.src(paths.src)
  .pipe(cache('src'))
  .pipe(babel())
  .pipe(gulp.dest('dist')))

gulp.task('watch', () => {
  gulp.watch(paths.src, ['transpile'])
})

gulp.task('default', ['watch', 'transpile'])
